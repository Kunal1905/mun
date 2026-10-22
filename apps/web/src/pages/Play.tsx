import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, DoorOpen, Globe2, Hash, Lock, Plus, Radio, Shuffle, Sparkles, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { LIMITS, type AgendaMode, type RoomListItem, type Visibility } from "@mun/shared";
import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, Field, Input, Modal, Segmented, StatTile, Textarea } from "../components/ui";
import { useApi, useFetch } from "../lib/api";
import { categoryLabel } from "../lib/cn";
import { useMe } from "../lib/me";
import { useSocket } from "../lib/socket";

export default function Play() {
  const { me } = useMe();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!socket || !connected) return;
    socket.on("lobby:rooms", setRooms);
    socket.emit("lobby:subscribe");
    return () => {
      socket.emit("lobby:unsubscribe");
      socket.off("lobby:rooms", setRooms);
    };
  }, [socket, connected]);

  const join = (e: FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length >= 4) navigate(`/room/${clean}`);
  };

  const firstName = me?.user.displayName.split(" ")[0];

  return (
    <div className="bg-paper-grain">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Delegates' lounge</Eyebrow>
            <h1 className="mt-2 text-4xl font-semibold">{firstName ? `Welcome to the floor, ${firstName}.` : "Welcome to the floor."}</h1>
            <p className="mt-2 text-ink-500">Open a room for your committee, or join one that is about to begin.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:w-[420px]">
            <StatTile label="Points" value={me?.stats?.points ?? 0} />
            <StatTile label="Games won" value={me?.stats?.gamesWon ?? 0} />
            <StatTile label="Rank" value={me?.rank ? `#${me.rank}` : "-"} />
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-chamber group relative overflow-hidden rounded-2xl p-7 text-left text-paper shadow-lift transition hover:-translate-y-0.5"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-brass text-ink-900">
              <Plus className="size-6" />
            </span>
            <h2 className="mt-5 text-3xl font-semibold">Open a room</h2>
            <p className="mt-1 text-paper/70">Pick a crisis pool or write your own agendas. You chair the session.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brass-400">
              Configure session <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </button>

          <Card className="p-7">
            <span className="flex size-12 items-center justify-center rounded-xl bg-brass-100 text-brass-700">
              <DoorOpen className="size-6" />
            </span>
            <h2 className="mt-5 text-3xl font-semibold">Join with a code</h2>
            <p className="mt-1 text-ink-500">Your chair shares a six-character room code or invite link.</p>
            <form onSubmit={join} className="mt-5 flex gap-2">
              <div className="relative flex-1">
                <Hash className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="ABC123"
                  className="pl-9 font-mono text-lg tracking-[0.3em]"
                  aria-label="Room code"
                />
              </div>
              <Button type="submit" size="lg" disabled={code.length < 6}>
                Join
              </Button>
            </form>
          </Card>
        </div>

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Radio className="size-5 text-sage" /> Open public rooms
            </h2>
            <Badge tone={connected ? "sage" : "neutral"}>{connected ? "Live" : "Connecting"}</Badge>
          </div>
          <div className="mt-4">
            {!rooms ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-36 animate-pulse rounded-2xl bg-ink-700/5" />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <Card>
                <EmptyState icon={<Users className="size-6" />} title="No open rooms right now">
                  Be the first - open a public room and it will appear here for every delegate online.
                </EmptyState>
              </Card>
            ) : (
              <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {rooms.map((r) => (
                    <motion.button
                      layout
                      key={r.code}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      onClick={() => navigate(`/room/${r.code}`)}
                      className="group rounded-2xl border border-ink-700/10 bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-lg font-semibold">{r.name}</h3>
                        <span className="font-mono text-xs text-ink-400">{r.code}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-400">Chaired by {r.hostName}</p>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <Badge tone="brass">{categoryLabel(r.category)}</Badge>
                        <Badge>{r.roundsTotal} rounds</Badge>
                        {r.agendaMode === "custom" && <Badge tone="sage">Custom agenda</Badge>}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-ink-500">
                          <Users className="size-4" />
                          {r.players}/{r.maxPlayers}
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-700/10">
                            <span className="block h-full rounded-full bg-sage" style={{ width: `${(r.players / r.maxPlayers) * 100}%` }} />
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-brass-700 opacity-0 transition group-hover:opacity-100">Join →</span>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useApi();
  const navigate = useNavigate();
  const { me } = useMe();
  const categories = useFetch<{ categories: { id: string; count: number }[] }>(open ? "/agendas/categories" : null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [agendaMode, setAgendaMode] = useState<AgendaMode>("random");
  const [category, setCategory] = useState<string | null>(null);
  const [rounds, setRounds] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !name && me) setName(`${me.user.displayName.split(" ")[0]}'s Committee`);
  }, [open, me, name]);

  const customLines = custom
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { code } = await api<{ code: string }>("/rooms", {
        body: { name, visibility, agendaMode, category, roundsTotal: rounds, maxPlayers, customAgendas: customLines.slice(0, rounds) },
      });
      navigate(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room.");
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Open a room" wide>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Room name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.roomName} required />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Visibility" hint={visibility === "public" ? "Listed in the lounge for anyone to join." : "Only people with the code can join."}>
            <Segmented
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "public", label: <span className="inline-flex items-center gap-1.5"><Globe2 className="size-4" /> Public</span> },
                { value: "private", label: <span className="inline-flex items-center gap-1.5"><Lock className="size-4" /> Private</span> },
              ]}
            />
          </Field>
          <Field label="Agenda" hint={agendaMode === "random" ? "Drawn from the curated crisis pool." : "You write the agenda for each round."}>
            <Segmented
              value={agendaMode}
              onChange={setAgendaMode}
              options={[
                { value: "random", label: <span className="inline-flex items-center gap-1.5"><Shuffle className="size-4" /> Random</span> },
                { value: "custom", label: <span className="inline-flex items-center gap-1.5"><Sparkles className="size-4" /> Custom</span> },
              ]}
            />
          </Field>
        </div>

        {agendaMode === "random" ? (
          <Field label="Crisis pool">
            <div className="flex flex-wrap gap-2">
              <CategoryChip active={category === null} onClick={() => setCategory(null)}>
                Any topic
              </CategoryChip>
              {categories.data?.categories.map((c) => (
                <CategoryChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                  {categoryLabel(c.id)} <span className="opacity-50">{c.count}</span>
                </CategoryChip>
              ))}
            </div>
          </Field>
        ) : (
          <Field
            label={`Your agendas - one per line (${customLines.length}/${rounds})`}
            hint="Rounds without a custom agenda draw from the crisis pool."
          >
            <Textarea
              rows={4}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={"Should the UN regulate AI-generated election content?\nA famine declaration is blocked by a veto - what now?"}
            />
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={`Rounds: ${rounds}`}>
            <input type="range" min={LIMITS.minRounds} max={LIMITS.maxRounds} value={rounds} onChange={(e) => setRounds(+e.target.value)} className="w-full accent-[#B8893B]" />
          </Field>
          <Field label={`Seats: ${maxPlayers}`}>
            <input type="range" min={LIMITS.minPlayers} max={LIMITS.maxPlayers} value={maxPlayers} onChange={(e) => setMaxPlayers(+e.target.value)} className="w-full accent-[#B8893B]" />
          </Field>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="brass" loading={busy} disabled={agendaMode === "custom" && customLines.length === 0}>
            Open the session
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-ink-700 px-3.5 py-1.5 text-sm font-medium text-paper"
          : "rounded-full border border-ink-700/15 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-600 hover:border-ink-700/30"
      }
    >
      {children}
    </button>
  );
}
