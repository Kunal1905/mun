import { ArrowLeft, Crown, Hand, MessagesSquare } from "lucide-react";
import { Link, useParams } from "react-router";
import { Avatar, Badge, Card, ErrorNote, Eyebrow, PageLoader } from "../components/ui";
import { useFetch } from "../lib/api";
import { categoryLabel, cn } from "../lib/cn";

interface ReplayResponse {
  room: {
    id: string;
    name: string;
    code: string;
    finishedAt: string | null;
    ranked: boolean;
    players: { id: string; displayName: string; imageUrl: string | null; roundWins: number; votesReceived: number; isWinner: boolean }[];
    rounds: {
      id: string;
      number: number;
      winnerPlayerIds: string[];
      agenda: { title: string; brief: string; category: string; twist: string | null };
      speeches: { id: string; playerId: string; displayName: string; delegation: string | null; text: string; agree: number; disagree: number; applause: number; poiText: string | null; poiFromName: string | null }[];
      resolutions: { id: string; playerId: string; displayName: string; text: string; votes: number; isWinner: boolean }[];
    }[];
  };
  chat: { id: string; kind: string; displayName: string; text: string; createdAt: string }[];
}

export default function Replay() {
  const { roomId } = useParams();
  const { data, loading, error } = useFetch<ReplayResponse>(`/replay/${roomId}`);

  if (loading) return <PageLoader />;
  if (error || !data)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorNote>{error ?? "Replay not found."}</ErrorNote>
      </div>
    );

  const { room, chat } = data;
  return (
    <div className="bg-paper-grain">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <Eyebrow className="mt-4">Session replay · {room.code}</Eyebrow>
        <h1 className="mt-2 text-4xl font-semibold">{room.name}</h1>
        <p className="mt-1 text-ink-500">
          {room.finishedAt ? new Date(room.finishedAt).toLocaleString() : ""} · {room.ranked ? "Ranked" : "Unranked"} · {room.players.length} delegates
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {room.players.map((p) => (
            <span key={p.id} className={cn("inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm", p.isWinner ? "bg-ink-700 text-paper" : "bg-white shadow-card")}>
              <Avatar name={p.displayName} src={p.imageUrl} size={24} />
              {p.displayName}
              {p.isWinner && <Crown className="size-3.5 text-brass-400" />}
              <span className="text-xs opacity-60">
                {p.roundWins}R · {p.votesReceived}V
              </span>
            </span>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          {room.rounds.map((round) => (
            <Card key={round.id} className="overflow-hidden">
              <div className="bg-chamber p-6 text-paper">
                <div className="flex gap-2">
                  <Badge tone="dark">Round {round.number}</Badge>
                  <Badge tone="brass">{categoryLabel(round.agenda.category)}</Badge>
                </div>
                <h2 className="mt-3 text-2xl font-semibold">{round.agenda.title}</h2>
                <p className="mt-1 text-sm text-paper/70">{round.agenda.brief}</p>
                {round.agenda.twist && <p className="mt-3 text-sm text-crimson">Crisis update: {round.agenda.twist}</p>}
              </div>
              <div className="grid gap-6 p-6 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">Speeches</h3>
                  <div className="mt-3 space-y-3">
                    {round.speeches.map((s) => (
                      <div key={s.id} className="rounded-xl bg-paper p-4">
                        <div className="text-sm font-semibold">
                          {s.displayName} <span className="font-normal text-ink-400">· {s.delegation}</span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">{s.text || <em className="text-ink-300">Yielded without speaking.</em>}</p>
                        {s.poiText && (
                          <p className="mt-2 flex gap-1.5 text-xs text-ink-500">
                            <Hand className="size-3.5 text-brass" /> {s.poiFromName}: {s.poiText}
                          </p>
                        )}
                        <div className="mt-2 flex gap-3 text-xs text-ink-400">
                          <span>👍 {s.agree}</span>
                          <span>👎 {s.disagree}</span>
                          <span>👏 {s.applause}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">Resolutions</h3>
                  <div className="mt-3 space-y-2">
                    {round.resolutions.length === 0 && <p className="text-sm text-ink-400">No resolutions submitted.</p>}
                    {round.resolutions.map((r) => (
                      <div key={r.id} className={cn("rounded-xl border p-4", r.isWinner ? "border-brass bg-brass-100/50" : "border-ink-700/10")}>
                        <div className="flex items-start gap-3">
                          <p className="flex-1 font-display leading-snug">{r.text}</p>
                          <span className="font-display text-xl font-semibold">{r.votes}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                          {r.isWinner && <Crown className="size-3 text-brass" />} {r.displayName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {chat.length > 0 && (
          <Card className="mt-8 p-6">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
              <MessagesSquare className="size-4" /> Committee chat
            </h3>
            <div className="scrollbar-thin mt-3 max-h-96 space-y-1.5 overflow-y-auto text-sm">
              {chat.map((m) => (
                <p key={m.id} className={m.kind === "system" ? "italic text-brass-700" : "text-ink-600"}>
                  {m.kind !== "system" && <span className="font-semibold text-ink-700">{m.displayName}: </span>}
                  {m.text}
                </p>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
