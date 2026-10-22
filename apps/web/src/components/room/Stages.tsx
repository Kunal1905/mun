import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Flag,
  Hand,
  Loader2,
  Mic,
  PartyPopper,
  PenLine,
  Repeat,
  ScrollText,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Vote as VoteIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { LIMITS, type FeedbackView, type Reaction, type RoomState, type SpeechView } from "@mun/shared";
import { categoryLabel, cn } from "../../lib/cn";
import { CoachingCard } from "../CoachingCard";
import { Avatar, Badge, Button } from "../ui";

export interface StageActions {
  setReady: (ready: boolean) => void;
  start: () => Promise<void>;
  updateSpeech: (text: string) => void;
  yieldFloor: () => void;
  react: (playerId: string, reaction: Reaction) => void;
  poi: (text: string) => void;
  submitResolution: (text: string) => Promise<boolean>;
  vote: (resolutionId: string) => Promise<void>;
  report: (target: { type: "resolution" | "speech"; id: string; text: string }) => void;
  rematch: () => Promise<void>;
}

const panel = "rounded-3xl bg-white/[0.04] ring-1 ring-white/10";

// ------------------------------------------------------------------ Lobby

export function LobbyStage({ state, actions, inviteUrl }: { state: RoomState; actions: StageActions; inviteUrl: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [starting, setStarting] = useState(false);
  const me = state.players.find((p) => p.id === state.me?.playerId);
  const isHost = !!state.me?.isHost;
  const connected = state.players.filter((p) => p.isConnected);
  const waitingOn = connected.filter((p) => !p.isReady);
  const canStart = isHost && connected.length >= LIMITS.minPlayers && waitingOn.length === 0;

  const copy = async (what: "code" | "link") => {
    await navigator.clipboard.writeText(what === "code" ? state.code : inviteUrl).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="space-y-5">
      <div className={cn(panel, "relative overflow-hidden p-8 text-center")}>
        <div className="absolute inset-x-0 -top-24 mx-auto size-64 rounded-full bg-brass/20 blur-3xl" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.25em] text-brass-400">Room code</p>
        <button onClick={() => copy("code")} className="relative mt-3 font-mono text-5xl font-bold tracking-[0.35em] text-paper transition hover:text-brass-400 sm:text-6xl">
          {state.code}
        </button>
        <p className="relative mt-3 text-sm text-paper/60">Share the code or the invite link. Delegates join instantly - no setup.</p>
        <div className="relative mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="light" size="sm" onClick={() => copy("code")} icon={copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}>
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
          <Button variant="brass" size="sm" onClick={() => copy("link")} icon={copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}>
            {copied === "link" ? "Link copied" : "Copy invite link"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Agenda", state.agendaMode === "custom" ? "Custom" : categoryLabel(state.category)],
          ["Rounds", state.roundsTotal],
          ["Seats", `${state.players.length}/${state.maxPlayers}`],
          ["Visibility", state.visibility === "public" ? "Public" : "Private"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <div className="text-[11px] uppercase tracking-wider text-paper/40">{k}</div>
            <div className="mt-1 font-display text-xl font-semibold text-paper">{v}</div>
          </div>
        ))}
      </div>

      <div className={cn(panel, "flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between")}>
        <div className="text-sm text-paper/70">
          {connected.length < LIMITS.minPlayers
            ? `Waiting for at least ${LIMITS.minPlayers} delegates...`
            : waitingOn.length
              ? `Waiting on ${waitingOn.map((p) => p.displayName).join(", ")} to ready up.`
              : "Everyone is ready. The chair may open the session."}
        </div>
        {isHost ? (
          <Button
            variant="brass"
            size="lg"
            disabled={!canStart}
            loading={starting}
            onClick={async () => {
              setStarting(true);
              await actions.start();
              setStarting(false);
            }}
            icon={<PartyPopper className="size-4" />}
          >
            Open the session
          </Button>
        ) : (
          <Button variant={me?.isReady ? "light" : "brass"} size="lg" onClick={() => actions.setReady(!me?.isReady)} icon={me?.isReady ? <CheckCircle2 className="size-4" /> : <Hand className="size-4" />}>
            {me?.isReady ? "Ready - click to undo" : "I'm ready"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Agenda header (used in every game phase)

export function AgendaBanner({ state, compact }: { state: RoomState; compact?: boolean }) {
  if (!state.agenda) return null;
  const me = state.players.find((p) => p.id === state.me?.playerId);
  return (
    <div className={cn(panel, compact ? "p-5" : "p-7")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="dark">
          Round {state.roundNumber} of {state.roundsTotal}
        </Badge>
        <Badge tone="brass">{categoryLabel(state.agenda.category)}</Badge>
        {me?.delegation && (
          <span className="ml-auto text-xs text-paper/60">
            You represent <span className="font-semibold text-brass-400">{me.delegation}</span>
          </span>
        )}
      </div>
      <h2 className={cn("mt-3 font-semibold text-paper text-balance", compact ? "text-2xl" : "text-4xl")}>{state.agenda.title}</h2>
      {!compact && <p className="mt-3 max-w-3xl text-lg leading-relaxed text-paper/70">{state.agenda.brief}</p>}
      {state.agenda.twist && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex gap-3 rounded-2xl border border-crimson/40 bg-crimson/15 p-4 text-sm text-paper"
        >
          <AlertTriangle className="size-5 shrink-0 text-crimson" />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-crimson">Crisis update</div>
            {state.agenda.twist}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function AgendaStage({ state }: { state: RoomState }) {
  const me = state.players.find((p) => p.id === state.me?.playerId);
  const order = state.speakingOrder.map((id) => state.players.find((p) => p.id === id)).filter(Boolean);
  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <AgendaBanner state={state} />
      </motion.div>
      <div className="grid gap-5 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={cn(panel, "p-6")}>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">Your delegation</div>
          <div className="mt-2 font-display text-3xl font-semibold text-paper">{me?.delegation ?? "Observer"}</div>
          <p className="mt-2 text-sm text-paper/60">Argue from this delegation's interests. What do they stand to gain - or lose?</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={cn(panel, "p-6")}>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">Speaking order</div>
          <ol className="mt-3 space-y-2">
            {order.map((p, i) => (
              <li key={p!.id} className="flex items-center gap-3 text-sm text-paper">
                <span className="w-5 text-center font-mono text-paper/40">{i + 1}</span>
                <Avatar name={p!.displayName} src={p!.imageUrl} size={26} />
                <span className="font-medium">{p!.displayName}</span>
                <span className="truncate text-paper/50">{p!.delegation}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Debate

const REACTION_META: Record<Reaction, { label: string; icon: typeof ThumbsUp; on: string }> = {
  agree: { label: "Agree", icon: ThumbsUp, on: "bg-sage text-white" },
  disagree: { label: "Disagree", icon: ThumbsDown, on: "bg-crimson text-white" },
  applause: { label: "Applause", icon: PartyPopper, on: "bg-brass text-ink-900" },
};

export function DebateStage({ state, actions, liveText }: { state: RoomState; actions: StageActions; liveText: Record<string, string> }) {
  const speakerId = state.currentSpeakerId;
  const speaker = state.players.find((p) => p.id === speakerId);
  const isMe = !!speakerId && speakerId === state.me?.playerId;
  const current = state.speeches.find((s) => s.playerId === speakerId);
  const done = state.speeches.filter((s) => s.done);

  return (
    <div className="space-y-5">
      <AgendaBanner state={state} compact />
      {speaker && current && (
        <motion.div key={speaker.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(panel, "p-6")}>
          <div className="flex items-center gap-3">
            <div className="animate-pulse-ring rounded-full">
              <Avatar name={speaker.displayName} src={speaker.imageUrl} size={44} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">
                <Mic className="size-3.5" /> {isMe ? "You have the floor" : "Has the floor"}
              </div>
              <div className="truncate text-lg font-semibold text-paper">
                {speaker.displayName} <span className="font-normal text-paper/50">· {speaker.delegation}</span>
              </div>
            </div>
            {isMe && (
              <Button variant="light" size="sm" onClick={actions.yieldFloor}>
                Yield the floor
              </Button>
            )}
          </div>

          {isMe ? <SpeechComposer initial={current.text} onChange={actions.updateSpeech} /> : <LiveSpeech text={liveText[speaker.id] ?? current.text} />}

          {current.poi && <PoiNote poi={current.poi} />}

          {!isMe && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {(Object.keys(REACTION_META) as Reaction[]).map((r) => {
                const meta = REACTION_META[r];
                const on = current.myReactions.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() => actions.react(current.playerId, r)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95",
                      on ? meta.on : "bg-white/10 text-paper hover:bg-white/15",
                    )}
                  >
                    <meta.icon className="size-4" /> {meta.label}
                    <span className="tabular-nums opacity-70">{current.reactions[r]}</span>
                  </button>
                );
              })}
              <PoiButton disabled={state.myPoiUsed || !!current.poi} onSubmit={actions.poi} />
            </div>
          )}
          {isMe && (
            <div className="mt-4 flex gap-4 text-sm text-paper/60">
              <span>👍 {current.reactions.agree}</span>
              <span>👎 {current.reactions.disagree}</span>
              <span>👏 {current.reactions.applause}</span>
            </div>
          )}
        </motion.div>
      )}

      {done.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-paper/40">Earlier on the floor</h3>
          {[...done].reverse().map((s) => (
            <SpeechRecord key={s.playerId} speech={s} onReport={s.playerId === state.me?.playerId ? undefined : () => actions.report({ type: "speech", id: s.playerId, text: s.text })} />
          ))}
        </div>
      )}
    </div>
  );
}

function SpeechComposer({ initial, onChange }: { initial: string; onChange: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="mt-4">
      <textarea
        ref={ref}
        value={text}
        maxLength={LIMITS.speech}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        rows={6}
        placeholder="Make your case. Everyone in the room sees your words as you type them..."
        className="w-full resize-none rounded-2xl border border-brass/30 bg-ink-900/40 p-4 text-lg leading-relaxed text-paper placeholder:text-paper/30 focus:border-brass focus:outline-none"
      />
      <div className="mt-1 text-right text-xs text-paper/40">
        {text.length}/{LIMITS.speech}
      </div>
    </div>
  );
}

function LiveSpeech({ text }: { text: string }) {
  return (
    <div className="mt-4 min-h-[8rem] rounded-2xl bg-ink-900/40 p-5 text-lg leading-relaxed text-paper">
      {text ? (
        <>
          {text}
          <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-brass" />
        </>
      ) : (
        <span className="flex items-center gap-2 text-paper/40">
          <Loader2 className="size-4 animate-spin" /> Gathering their thoughts...
        </span>
      )}
    </div>
  );
}

function PoiNote({ poi }: { poi: { fromName: string; text: string } }) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="mt-4 flex gap-3 rounded-2xl border-l-4 border-brass bg-brass/10 p-4 text-sm text-paper">
      <Hand className="size-4 shrink-0 text-brass-400" />
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brass-400">Point of information · {poi.fromName}</div>
        {poi.text}
      </div>
    </motion.div>
  );
}

function PoiButton({ disabled, onSubmit }: { disabled: boolean; onSubmit: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brass/40 px-3.5 py-1.5 text-sm font-medium text-brass-400 transition hover:bg-brass/10 disabled:opacity-30"
        title={disabled ? "One point of information per speaker, one per delegate per round" : undefined}
      >
        <Hand className="size-4" /> Point of information
      </button>
    );
  return (
    <form
      className="flex w-full gap-2 sm:ml-auto sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(text);
        setOpen(false);
        setText("");
      }}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={LIMITS.poi}
        placeholder="Your question to the speaker"
        className="h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-paper placeholder:text-paper/30 focus:border-brass focus:outline-none sm:w-64"
      />
      <Button size="sm" variant="brass" type="submit" icon={<Send className="size-3.5" />}>
        Raise
      </Button>
    </form>
  );
}

function SpeechRecord({ speech, onReport }: { speech: SpeechView; onReport?: () => void }) {
  return (
    <div className="group rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-paper">{speech.displayName}</span>
        <span className="text-paper/40">{speech.delegation}</span>
        <span className="ml-auto flex gap-3 text-xs text-paper/50">
          <span>👍 {speech.reactions.agree}</span>
          <span>👎 {speech.reactions.disagree}</span>
          <span>👏 {speech.reactions.applause}</span>
        </span>
        {onReport && speech.text && (
          <button onClick={onReport} className="text-paper/20 opacity-0 transition hover:text-crimson group-hover:opacity-100" title="Report">
            <Flag className="size-3.5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-paper/75">{speech.text || <em className="text-paper/30">Yielded without speaking.</em>}</p>
      {speech.poi && (
        <p className="mt-2 border-l-2 border-brass/50 pl-3 text-xs text-paper/60">
          <span className="font-semibold text-brass-400">POI · {speech.poi.fromName}:</span> {speech.poi.text}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Drafting

export function DraftingStage({ state, actions }: { state: RoomState; actions: StageActions }) {
  const [text, setText] = useState(state.myResolution ?? "");
  const [busy, setBusy] = useState(false);
  const submitted = state.myResolution !== null;
  const dirty = text.trim() !== (state.myResolution ?? "");
  const pending = state.players.filter((p) => p.isConnected && !state.submittedPlayerIds.includes(p.id));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await actions.submitResolution(text);
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <AgendaBanner state={state} compact />
      <form onSubmit={submit} className={cn(panel, "p-6")}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">
          <PenLine className="size-4" /> Draft your resolution
        </div>
        <p className="mt-1 text-sm text-paper/60">One line. Who acts, what they do, and by when. It will be shown anonymously.</p>
        <div className="relative mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
            maxLength={LIMITS.resolution}
            rows={3}
            autoFocus
            placeholder="The Assembly establishes an independent cable-security taskforce, funded by..."
            className="w-full resize-none rounded-2xl border border-brass/30 bg-ink-900/40 p-4 font-display text-xl leading-relaxed text-paper placeholder:text-paper/25 focus:border-brass focus:outline-none"
          />
          <span className={cn("absolute bottom-3 right-4 text-xs tabular-nums", text.length > LIMITS.resolution - 20 ? "text-crimson" : "text-paper/40")}>
            {text.length}/{LIMITS.resolution}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-paper/60">
            {pending.length === 0 ? "All drafts are in." : `Waiting on ${pending.length} delegate${pending.length === 1 ? "" : "s"}`}
          </span>
          <Button type="submit" variant="brass" size="lg" loading={busy} disabled={text.trim().length < 8 || (!dirty && submitted)} icon={submitted && !dirty ? <Check className="size-4" /> : <Send className="size-4" />}>
            {submitted ? (dirty ? "Update draft" : "Submitted") : "Submit resolution"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ Voting

export function VotingStage({ state, actions }: { state: RoomState; actions: StageActions }) {
  const [busy, setBusy] = useState<string | null>(null);
  const voters = state.players.filter((p) => p.isConnected).length;
  return (
    <div className="space-y-5">
      <AgendaBanner state={state} compact />
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-paper">
          <VoteIcon className="size-5 text-brass-400" /> Vote for the strongest resolution
        </h3>
        <span className="text-sm text-paper/50">
          {state.votedPlayerIds.length}/{voters} voted
        </span>
      </div>
      <div className="grid gap-3">
        {state.resolutions.map((r, i) => {
          const chosen = state.myVote === r.id;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "group flex items-center gap-4 rounded-2xl p-5 ring-1 transition",
                chosen ? "bg-brass/15 ring-brass" : "bg-white/[0.04] ring-white/10 hover:ring-white/25",
              )}
            >
              <span className="font-display text-2xl font-semibold text-paper/30">{String.fromCharCode(65 + i)}</span>
              <p className="flex-1 font-display text-lg leading-snug text-paper">{r.text}</p>
              {r.isMine ? (
                <Badge tone="dark">Yours</Badge>
              ) : (
                <>
                  <button
                    onClick={() => actions.report({ type: "resolution", id: r.id, text: r.text })}
                    className="text-paper/20 opacity-0 transition hover:text-crimson group-hover:opacity-100"
                    title="Report"
                  >
                    <Flag className="size-4" />
                  </button>
                  <Button
                    variant={chosen ? "brass" : "light"}
                    size="sm"
                    loading={busy === r.id}
                    onClick={async () => {
                      setBusy(r.id);
                      await actions.vote(r.id);
                      setBusy(null);
                    }}
                    icon={chosen ? <Check className="size-4" /> : undefined}
                  >
                    {chosen ? "Your vote" : "Vote"}
                  </Button>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
      <p className="text-center text-xs text-paper/40">Authors stay hidden until the reveal. Voting closes when the timer ends or everyone has voted.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Reveal

export function RevealStage({ state }: { state: RoomState }) {
  const max = Math.max(1, ...state.reveal.map((r) => r.votes));
  const winners = state.reveal.filter((r) => r.isWinner);
  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={cn(panel, "relative overflow-hidden p-8 text-center")}>
        <div className="absolute inset-x-0 -top-20 mx-auto size-72 rounded-full bg-brass/25 blur-3xl" />
        <Trophy className="relative mx-auto size-10 text-brass-400" />
        <p className="relative mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-brass-400">Round {state.roundNumber} result</p>
        <h2 className="relative mt-2 text-3xl font-semibold text-paper">
          {winners.length ? `${winners.map((w) => w.displayName).join(" & ")} ${winners.length > 1 ? "share" : "takes"} the round` : "No winning resolution"}
        </h2>
        {winners[0] && <p className="relative mx-auto mt-3 max-w-2xl font-display text-xl italic text-paper/80">"{winners[0].text}"</p>}
      </motion.div>
      <div className="space-y-2.5">
        {state.reveal.map((r, i) => (
          <motion.div
            key={r.resolutionId}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className={cn("relative overflow-hidden rounded-2xl p-4 ring-1", r.isWinner ? "ring-brass" : "ring-white/10")}
          >
            <motion.div
              className={cn("absolute inset-y-0 left-0", r.isWinner ? "bg-brass/20" : "bg-white/5")}
              initial={{ width: 0 }}
              animate={{ width: `${(r.votes / max) * 100}%` }}
              transition={{ delay: 0.5 + i * 0.15, duration: 0.7, ease: "easeOut" }}
            />
            <div className="relative flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-paper">{r.text}</p>
                <p className="mt-1 text-xs text-paper/50">
                  {r.displayName} · {r.delegation}
                </p>
              </div>
              {r.isWinner && <Crown className="size-5 text-brass-400" />}
              <span className="font-display text-2xl font-semibold tabular-nums text-paper">{r.votes}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Finished

export function FinishedStage({
  state,
  actions,
  feedback,
}: {
  state: RoomState;
  actions: StageActions;
  feedback: FeedbackView | null;
}) {
  const [busy, setBusy] = useState(false);
  const podium = state.standings.slice(0, 3);
  const winners = state.standings.filter((s) => s.isWinner);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(panel, "relative overflow-hidden p-8 text-center")}>
        <div className="absolute inset-x-0 -top-24 mx-auto size-80 rounded-full bg-brass/25 blur-3xl" />
        <Crown className="relative mx-auto size-12 text-brass-400" />
        <p className="relative mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-brass-400">Session closed</p>
        <h2 className="relative mt-2 text-4xl font-semibold text-paper">
          {winners.length ? `${winners.map((w) => w.displayName).join(" & ")} ${winners.length > 1 ? "win" : "wins"} the room` : "No winner this session"}
        </h2>
        <p className="relative mt-2 text-sm text-paper/60">
          {state.ranked ? "Ranked game - points have been added to the global leaderboard." : "Unranked game - more delegates are needed for leaderboard points."}
        </p>

        <div className="relative mx-auto mt-8 flex max-w-lg items-end justify-center gap-3">
          {[podium[1], podium[0], podium[2]].map((p, i) =>
            p ? (
              <motion.div
                key={p.playerId}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.12 }}
                className="flex flex-1 flex-col items-center"
              >
                <Avatar name={p.displayName} size={i === 1 ? 56 : 44} ring={p.isWinner} />
                <span className="mt-2 max-w-full truncate text-sm font-semibold text-paper">{p.displayName}</span>
                <span className="text-xs text-paper/50">
                  {p.roundWins} rounds · {p.votesReceived} votes
                </span>
                <div
                  className={cn("mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 font-display text-2xl font-bold", i === 1 ? "h-24 bg-brass text-ink-900" : "h-16 bg-white/10 text-paper")}
                >
                  {i === 1 ? 1 : i === 0 ? 2 : 3}
                </div>
              </motion.div>
            ) : null,
          )}
        </div>
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          {feedback ? (
            <CoachingCard feedback={feedback} dark />
          ) : (
            <div className={cn(panel, "flex items-center gap-3 p-6 text-sm text-paper/60")}>
              <Loader2 className="size-4 animate-spin text-brass-400" /> Your coach is reviewing your speeches...
            </div>
          )}
        </div>
        <div className={cn(panel, "p-6")}>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">
            <ScrollText className="size-4" /> Rounds
          </h3>
          <ol className="mt-3 space-y-3">
            {state.history.map((h) => (
              <li key={h.number} className="text-sm">
                <div className="text-paper">
                  <span className="mr-2 font-mono text-paper/40">{h.number}</span>
                  {h.agendaTitle}
                </div>
                <div className="ml-6 text-xs text-paper/50">{h.winnerNames.length ? `Won by ${h.winnerNames.join(" & ")}` : "No winner"}</div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col gap-2">
            {state.me?.isHost && (
              <Button
                variant="brass"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  await actions.rematch();
                  setBusy(false);
                }}
                icon={<Repeat className="size-4" />}
              >
                Rematch with this table
              </Button>
            )}
            <Link to={`/replay/${state.id}`}>
              <Button variant="light" className="w-full" icon={<ScrollText className="size-4" />}>
                View full replay
              </Button>
            </Link>
            <Link to="/play">
              <Button variant="ghost" className="w-full text-paper/70 hover:bg-white/5">
                Back to the lounge
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AnimatePresence };
