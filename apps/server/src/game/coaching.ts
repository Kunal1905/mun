import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { FeedbackView } from "@mun/shared";
import { db } from "../db/index.js";
import { feedback } from "../db/schema.js";
import { env } from "../env.js";
import type { FinishedGame } from "./GameRoom.js";

type Dimension = "clarity" | "relevance" | "persuasiveness" | "conciseness";

interface PlayerDossier {
  displayName: string;
  rounds: {
    agendaTitle: string;
    agendaBrief: string;
    delegation: string | null;
    speech: string;
    reactions: { agree: number; disagree: number; applause: number };
    poiReceived: string | null;
    resolution: string | null;
    votes: number;
    wonRound: boolean;
  }[];
  playersInRoom: number;
}

interface Coaching {
  scores: Record<Dimension, number>;
  advice: Record<Dimension, string>;
  bestLine: string | null;
  summary: string;
  source: "ai" | "rules";
}

const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const CoachingSchema = z.object({
  clarity: z.number(),
  relevance: z.number(),
  persuasiveness: z.number(),
  conciseness: z.number(),
  clarity_advice: z.string(),
  relevance_advice: z.string(),
  persuasiveness_advice: z.string(),
  conciseness_advice: z.string(),
  best_line: z.string(),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are a Model United Nations debate coach giving a delegate their post-game feedback card.
Score the delegate from 1 to 10 on clarity, relevance (to the agenda and their delegation's interests), persuasiveness, and conciseness.
For each dimension write exactly one sentence of concrete, actionable advice that quotes or refers to what they actually wrote.
best_line is the single strongest sentence they wrote, copied verbatim (empty string if they wrote nothing).
summary is one encouraging sentence on their overall performance.
You never judge who won - the table voted on that. Be honest but constructive; an empty speech should score low.`;

/** Builds coaching cards for every player of a finished game and stores them. */
export async function coachGame(game: FinishedGame, deliver: (userId: string, feedback: FeedbackView) => void) {
  await Promise.all(
    game.players.map(async (player) => {
      try {
        const dossier = buildDossier(game, player.playerId, player.displayName);
        const coaching = (await aiCoaching(dossier)) ?? ruleCoaching(dossier);
        const inserted = await db
          .insert(feedback)
          .values({
            roomId: game.roomId,
            userId: player.userId,
            ...coaching.scores,
            advice: coaching.advice,
            bestLine: coaching.bestLine,
            summary: coaching.summary,
            source: coaching.source,
          })
          .onConflictDoNothing()
          .returning();
        const row = inserted[0];
        if (!row) return; // already coached (e.g. duplicate finish)
        deliver(player.userId, {
          id: row.id,
          roomId: game.roomId,
          roomName: game.roomName,
          clarity: row.clarity,
          relevance: row.relevance,
          persuasiveness: row.persuasiveness,
          conciseness: row.conciseness,
          advice: row.advice,
          bestLine: row.bestLine,
          summary: row.summary,
          source: row.source as FeedbackView["source"],
          createdAt: row.createdAt.toISOString(),
        });
      } catch (err) {
        console.error("[coaching]", err);
      }
    }),
  );
}

function buildDossier(game: FinishedGame, playerId: string, displayName: string): PlayerDossier {
  return {
    displayName,
    playersInRoom: game.players.length,
    rounds: game.rounds.map((round) => {
      const speech = round.speeches.get(playerId);
      const resolution = round.resolutions.get(playerId);
      const reveal = round.reveal.find((r) => r.playerId === playerId);
      return {
        agendaTitle: round.agenda.title,
        agendaBrief: round.agenda.brief,
        delegation: speech?.delegation ?? null,
        speech: speech?.text.trim() ?? "",
        reactions: speech?.reactions ?? { agree: 0, disagree: 0, applause: 0 },
        poiReceived: speech?.poi?.text ?? null,
        resolution: resolution?.text ?? null,
        votes: reveal?.votes ?? 0,
        wonRound: reveal?.isWinner ?? false,
      };
    }),
  };
}

async function aiCoaching(d: PlayerDossier): Promise<Coaching | null> {
  if (!anthropic) return null;
  const transcript = d.rounds
    .map(
      (r, i) => `Round ${i + 1}: "${r.agendaTitle}"
Brief: ${r.agendaBrief}
Delegation: ${r.delegation ?? "none"}
Speech: ${r.speech || "(no speech)"}
Point of information received: ${r.poiReceived ?? "none"}
Table reactions: ${r.reactions.agree} agree, ${r.reactions.disagree} disagree, ${r.reactions.applause} applause
Resolution: ${r.resolution ?? "(none submitted)"}
Votes received: ${r.votes} of ${d.playersInRoom - 1} possible${r.wonRound ? " (won the round)" : ""}`,
    )
    .join("\n\n");

  try {
    const response = await anthropic.messages.parse({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(CoachingSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Delegate: ${d.displayName}\n\n${transcript}` }],
    });
    if (response.stop_reason === "refusal") return null;
    const out = response.parsed_output;
    if (!out) return null;
    const score = (n: number) => Math.min(10, Math.max(1, Math.round(n)));
    return {
      scores: {
        clarity: score(out.clarity),
        relevance: score(out.relevance),
        persuasiveness: score(out.persuasiveness),
        conciseness: score(out.conciseness),
      },
      advice: {
        clarity: out.clarity_advice,
        relevance: out.relevance_advice,
        persuasiveness: out.persuasiveness_advice,
        conciseness: out.conciseness_advice,
      },
      bestLine: out.best_line.trim() || null,
      summary: out.summary,
      source: "ai",
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error("[coaching] ANTHROPIC_API_KEY is invalid.");
    else if (err instanceof Anthropic.RateLimitError) console.error("[coaching] Rate limited by the Anthropic API.");
    else if (err instanceof Anthropic.APIError) console.error(`[coaching] Anthropic API error ${err.status}: ${err.message}`);
    else console.error("[coaching]", err);
    return null;
  }
}

// ------------------------------------------------------------------ rule-based fallback

const STOPWORDS = new Set(
  "the and for that this with from have will their they them into been were which what when where while about would could should there these those than then over under after before because against between among".split(
    " ",
  ),
);

const words = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? [];
const keywords = (s: string) => new Set(words(s).filter((w) => w.length > 3 && !STOPWORDS.has(w)));
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 0);
const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n)));

export function ruleCoaching(d: PlayerDossier): Coaching {
  const speeches = d.rounds.map((r) => r.speech).filter(Boolean);
  const allSpeech = speeches.join(" ");
  const resolutions = d.rounds.map((r) => r.resolution).filter((r): r is string => !!r);
  const allSentences = sentences(allSpeech);

  // Clarity: sentences of 10-22 words read best.
  const avgLen = allSentences.length ? words(allSpeech).length / allSentences.length : 0;
  const clarity = speeches.length === 0 ? 2 : clamp(10 - Math.abs(avgLen - 16) / 2.5);

  // Relevance: overlap between what they wrote and the agenda text.
  const overlap = d.rounds.map((r) => {
    const agendaWords = keywords(`${r.agendaTitle} ${r.agendaBrief} ${r.delegation ?? ""}`);
    const theirs = keywords(`${r.speech} ${r.resolution ?? ""}`);
    if (theirs.size === 0) return 0;
    let hits = 0;
    for (const w of theirs) if (agendaWords.has(w)) hits++;
    return Math.min(1, hits / 5);
  });
  const relevance = clamp(2 + 8 * (overlap.reduce((a, b) => a + b, 0) / Math.max(1, overlap.length)));

  // Persuasiveness: what the table actually did - reactions and votes.
  const votes = d.rounds.reduce((a, r) => a + r.votes, 0);
  const possible = Math.max(1, (d.playersInRoom - 1) * d.rounds.length);
  const support = d.rounds.reduce((a, r) => a + r.reactions.agree + r.reactions.applause - r.reactions.disagree, 0);
  const persuasiveness = speeches.length === 0 && votes === 0 ? 2 : clamp(3 + 5 * (votes / possible) + Math.min(2, support / 3));

  // Conciseness: resolutions in the 60-140 character sweet spot, speeches under ~150 words.
  const resScore = resolutions.length
    ? resolutions.reduce((a, r) => a + (r.length >= 60 && r.length <= 140 ? 1 : r.length < 30 ? 0.3 : 0.7), 0) / resolutions.length
    : 0.2;
  const speechWords = speeches.length ? words(allSpeech).length / speeches.length : 0;
  const conciseness = clamp(3 + 5 * resScore + (speechWords > 0 && speechWords <= 150 ? 2 : 0));

  const bestLine =
    d.rounds.find((r) => r.wonRound && r.resolution)?.resolution ??
    [...allSentences].sort((a, b) => keywords(b).size - keywords(a).size)[0] ??
    resolutions[0] ??
    null;

  const advice: Record<Dimension, string> = {
    clarity:
      speeches.length === 0
        ? "Take the floor next time - even three short sentences give the table something to vote on."
        : avgLen > 22
          ? "Break long sentences in two; one idea per sentence lands harder in a 60-second speech."
          : avgLen < 8
            ? "Connect your points with 'because' and 'therefore' so the table follows your reasoning."
            : "Your sentence rhythm is clear - keep leading with your position, then the evidence.",
    relevance:
      relevance >= 7
        ? "You stayed on the agenda; next time name a specific stakeholder to show you know the room."
        : "Tie every argument back to the agenda wording and your delegation's interest in it.",
    persuasiveness:
      votes === 0
        ? "Give the table a reason to back you: a concrete number, a deadline, or who pays."
        : "You won support - press the advantage by answering the strongest objection before it is raised.",
    conciseness:
      resolutions.length === 0
        ? "Always submit a resolution, even a rough one - a blank draft cannot win a round."
        : "Aim for a resolution of one clause: who acts, what they do, by when.",
  };

  const wins = d.rounds.filter((r) => r.wonRound).length;
  return {
    scores: { clarity, relevance, persuasiveness, conciseness },
    advice,
    bestLine,
    summary:
      wins > 0
        ? `${d.displayName} carried ${wins} round${wins > 1 ? "s" : ""} with ${votes} vote${votes === 1 ? "" : "s"} - strong diplomacy.`
        : `${d.displayName} collected ${votes} vote${votes === 1 ? "" : "s"}; sharpen the resolution and the wins will follow.`,
    source: "rules",
  };
}
