import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Lock, MessagesSquare, Users, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { LIMITS, type Ack, type ChatMessageView, type FeedbackView, type Reaction, type RoomState } from "@mun/shared";
import { ChatPanel } from "../components/room/Chat";
import { PlayerList } from "../components/room/Players";
import {
  AgendaStage,
  DebateStage,
  DraftingStage,
  FinishedStage,
  LobbyStage,
  RevealStage,
  VotingStage,
  type StageActions,
} from "../components/room/Stages";
import { PhaseStepper, PhaseTimer } from "../components/room/Timer";
import { Button, ErrorNote, Field, Logo, Modal, Spinner, Textarea } from "../components/ui";
import { useApi } from "../lib/api";
import { cn } from "../lib/cn";
import { useMe } from "../lib/me";
import { useSocket, type GameSocket } from "../lib/socket";
import { useToast } from "../lib/toast";

// Leaving is deferred briefly so React StrictMode's mount/unmount/mount in dev
// (or a fast re-render) does not bounce the player out of their seat.
let pendingLeave: { code: string; timer: ReturnType<typeof setTimeout> } | null = null;

type ReportTarget = { type: "resolution" | "speech" | "chat"; id: string; text: string };

export default function Room() {
  const { code: rawCode = "" } = useParams();
  const code = rawCode.toUpperCase();
  const navigate = useNavigate();
  const toast = useToast();
  const api = useApi();
  const { me } = useMe();
  const { socket, connected, error: socketError } = useSocket();

  const [state, setState] = useState<RoomState | null>(null);
  const [offset, setOffset] = useState(0);
  const [chat, setChat] = useState<ChatMessageView[]>([]);
  const [liveText, setLiveText] = useState<Record<string, string>>({});
  const [joinError, setJoinError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackView | null>(null);
  const [mobileTab, setMobileTab] = useState<"stage" | "chat" | "players">("stage");
  const [unread, setUnread] = useState(0);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechLatest = useRef("");

  // ---- socket wiring
  useEffect(() => {
    if (!socket || !connected) return;
    if (pendingLeave?.code === code) {
      clearTimeout(pendingLeave.timer);
      pendingLeave = null;
    }

    const onState = (s: RoomState) => {
      setState(s);
      setOffset(s.serverNow - Date.now());
    };
    const onHistory = (messages: ChatMessageView[]) => setChat(messages);
    const onMessage = (m: ChatMessageView) => {
      setChat((c) => [...c.slice(-199), m]);
      if (m.kind === "chat") setUnread((n) => n + 1);
    };
    const onLive = ({ playerId, text }: { playerId: string; text: string }) => setLiveText((t) => ({ ...t, [playerId]: text }));
    const onKicked = () => {
      toast("You were removed from the room.", "error");
      navigate("/play");
    };
    const onRematch = ({ code: next }: { code: string }) => {
      toast("Rematch! Heading to the new room.", "success");
      navigate(`/room/${next}`);
    };
    const onFeedback = (f: FeedbackView) => setFeedback(f);
    const onToast = (t: { kind: "info" | "error"; message: string }) => toast(t.message, t.kind);

    socket.on("room:state", onState);
    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("speech:live", onLive);
    socket.on("room:kicked", onKicked);
    socket.on("room:rematch", onRematch);
    socket.on("feedback:ready", onFeedback);
    socket.on("toast", onToast);

    socket.emit("room:join", { code }, (res: Ack) => {
      if (!res.ok) setJoinError(res.error);
      else setJoinError(null);
    });

    return () => {
      socket.off("room:state", onState);
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("speech:live", onLive);
      socket.off("room:kicked", onKicked);
      socket.off("room:rematch", onRematch);
      socket.off("feedback:ready", onFeedback);
      socket.off("toast", onToast);
      const s: GameSocket = socket;
      pendingLeave = { code, timer: setTimeout(() => s.emit("room:leave"), 400) };
    };
  }, [socket, connected, code, navigate, toast]);

  // A new speaker starts with a clean live buffer.
  useEffect(() => setLiveText({}), [state?.currentSpeakerId, state?.roundNumber]);

  // If the coaching card was generated before we got here, fetch it.
  useEffect(() => {
    if (state?.phase !== "finished" || feedback) return;
    const t = setTimeout(() => {
      api<{ feedback: FeedbackView | null }>(`/feedback/${state.id}`)
        .then((r) => r.feedback && setFeedback(r.feedback))
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [state?.phase, state?.id, feedback, api]);

  useEffect(() => {
    if (mobileTab === "chat") setUnread(0);
  }, [mobileTab, chat.length]);

  // ---- actions
  const emitAck = useCallback(
    <T,>(fn: (cb: (res: Ack<T>) => void) => void) =>
      new Promise<Ack<T>>((resolve) => {
        fn((res) => {
          if (!res.ok) toast(res.error, "error");
          resolve(res);
        });
      }),
    [toast],
  );

  const actions: StageActions = useMemo(
    () => ({
      setReady: (ready) => socket?.emit("room:ready", { ready }),
      start: async () => {
        if (socket) await emitAck((cb) => socket.emit("room:start", cb));
      },
      updateSpeech: (text) => {
        // Throttle keystrokes to ~6 updates per second.
        speechLatest.current = text;
        if (speechTimer.current) return;
        speechTimer.current = setTimeout(() => {
          speechTimer.current = null;
          socket?.emit("speech:update", { text: speechLatest.current });
        }, 160);
      },
      yieldFloor: () => {
        if (speechTimer.current) {
          clearTimeout(speechTimer.current);
          speechTimer.current = null;
          socket?.emit("speech:update", { text: speechLatest.current });
        }
        socket?.emit("speech:yield");
      },
      react: (playerId: string, reaction: Reaction) => socket?.emit("speech:react", { playerId, reaction }),
      poi: (text) => socket?.emit("speech:poi", { text }),
      submitResolution: async (text) => {
        if (!socket) return false;
        const res = await emitAck((cb) => socket.emit("resolution:submit", { text }, cb));
        if (res.ok) toast("Resolution submitted.", "success");
        return res.ok;
      },
      vote: async (resolutionId) => {
        if (socket) await emitAck((cb) => socket.emit("vote:cast", { resolutionId }, cb));
      },
      report: (target) => setReport(target),
      rematch: async () => {
        if (socket) await emitAck<{ code: string }>((cb) => socket.emit("room:rematch", cb));
      },
    }),
    [socket, emitAck, toast],
  );

  const sendChat = useCallback((text: string) => socket?.emit("chat:send", { text }), [socket]);
  const leave = () => {
    socket?.emit("room:leave");
    navigate("/play");
  };

  // ---- render
  if (joinError) {
    return (
      <div className="bg-chamber flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-paper p-8 text-center shadow-lift">
          <Lock className="mx-auto size-10 text-brass" />
          <h1 className="mt-4 text-2xl font-semibold">Can't enter room {code}</h1>
          <p className="mt-2 text-ink-500">{joinError}</p>
          <Link to="/play">
            <Button className="mt-6">Back to the lounge</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="bg-chamber flex min-h-dvh flex-col items-center justify-center gap-4 text-paper">
        <Spinner className="size-8" />
        <p className="text-sm text-paper/60">{socketError ?? `Entering room ${code}...`}</p>
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/room/${state.code}`;
  const stage = (() => {
    switch (state.phase) {
      case "lobby":
        return <LobbyStage state={state} actions={actions} inviteUrl={inviteUrl} />;
      case "agenda":
        return <AgendaStage state={state} />;
      case "debate":
        return <DebateStage state={state} actions={actions} liveText={liveText} />;
      case "drafting":
        return <DraftingStage key={state.roundNumber} state={state} actions={actions} />;
      case "voting":
        return <VotingStage state={state} actions={actions} />;
      case "reveal":
        return <RevealStage state={state} />;
      case "finished":
        return <FinishedStage state={state} actions={actions} feedback={feedback} />;
    }
  })();

  const kick = state.me?.isHost ? (playerId: string) => socket?.emit("room:kick", { playerId }) : undefined;

  return (
    <div className="bg-chamber flex min-h-dvh flex-col text-paper lg:h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <button onClick={leave} className="rounded-lg p-2 text-paper/60 transition hover:bg-white/10 hover:text-paper" title="Leave room">
            <ArrowLeft className="size-5" />
          </button>
          <Link to="/" className="hidden sm:block">
            <Logo light />
          </Link>
          <div className="mx-2 hidden h-6 w-px bg-white/10 sm:block" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{state.name}</div>
            <div className="font-mono text-xs text-paper/50">{state.code}</div>
          </div>
          <div className="ml-auto hidden md:block">{state.phase !== "lobby" && state.phase !== "finished" && <PhaseStepper phase={state.phase} />}</div>
          {!connected && (
            <span className="flex items-center gap-1.5 rounded-full bg-crimson/20 px-3 py-1 text-xs text-crimson">
              <WifiOff className="size-3.5" /> Reconnecting
            </span>
          )}
          {state.phaseEndsAt && <PhaseTimer phase={state.phase} endsAt={state.phaseEndsAt} offset={offset} size={48} />}
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="grid grid-cols-3 gap-1 border-b border-white/10 p-2 lg:hidden">
        {(
          [
            ["stage", "Floor", null],
            ["chat", "Chat", MessagesSquare],
            ["players", `Delegates (${state.players.length})`, Users],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={cn("relative rounded-lg py-2 text-sm font-medium", mobileTab === id ? "bg-white/10 text-paper" : "text-paper/50")}
          >
            {label}
            {id === "chat" && unread > 0 && mobileTab !== "chat" && (
              <span className="absolute right-2 top-1.5 rounded-full bg-brass px-1.5 text-[10px] font-bold text-ink-900">{unread}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className={cn("scrollbar-thin lg:min-h-0 lg:overflow-y-auto lg:pr-2", mobileTab !== "stage" && "hidden lg:block")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${state.phase}-${state.roundNumber}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {stage}
            </motion.div>
          </AnimatePresence>
        </main>

        <aside className={cn("flex flex-col gap-4 lg:min-h-0", mobileTab === "stage" && "hidden lg:flex")}>
          <section className={cn("rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10", mobileTab === "chat" && "hidden lg:block")}>
            <h3 className="mb-3 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-[0.2em] text-paper/50">
              <span>Delegates</span>
              <span>
                {state.players.filter((p) => p.isConnected).length}/{state.maxPlayers}
              </span>
            </h3>
            <div className="scrollbar-thin max-h-[40vh] overflow-y-auto lg:max-h-[32vh]">
              <PlayerList state={state} onKick={kick} />
            </div>
          </section>
          <section
            className={cn(
              "flex min-h-[60vh] flex-col rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 lg:min-h-0 lg:flex-1",
              mobileTab === "players" && "hidden lg:flex",
            )}
          >
            <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-[0.2em] text-paper/50">Committee chat</h3>
            <ChatPanel messages={chat} myUserId={me?.user.id} onSend={sendChat} onReport={(m) => setReport({ type: "chat", id: m.id, text: m.text })} />
          </section>
        </aside>
      </div>

      <ReportModal target={report} onClose={() => setReport(null)} />
    </div>
  );
}

function ReportModal({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason("");
    setError(null);
  }, [target]);

  return (
    <Modal open={!!target} onClose={onClose} title="Report content">
      {target && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/reports", { body: { targetType: target.type, targetId: target.id, targetText: target.text, reason } });
              toast("Thanks - the moderators will review it.", "success");
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not send the report.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <blockquote className="rounded-xl bg-paper-100 p-3 text-sm italic text-ink-600">"{target.text}"</blockquote>
          <Field label="What's wrong?">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={LIMITS.reportReason} placeholder="Offensive, spam, off-topic..." />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={reason.trim().length < 3}>
              Send report
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
