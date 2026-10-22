import { Check, Crown, History, Pencil, ScrollText, Sparkles, Trophy, Vote, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { LIMITS, type FeedbackView } from "@mun/shared";
import { CoachingCard } from "../components/CoachingCard";
import { Avatar, Badge, Button, Card, EmptyState, Eyebrow, Input, PageLoader, StatTile } from "../components/ui";
import { useApi, useFetch } from "../lib/api";
import { useMe } from "../lib/me";
import { timeAgo } from "../lib/time";
import { useToast } from "../lib/toast";

interface History {
  games: {
    roomId: string;
    code: string;
    name: string;
    finishedAt: string | null;
    ranked: boolean;
    roundsTotal: number;
    roundWins: number;
    votesReceived: number;
    isWinner: boolean;
  }[];
  feedback: FeedbackView[];
}

export default function Profile() {
  const { me, reload } = useMe();
  const history = useFetch<History>("/me/history");
  const api = useApi();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (!me) return <PageLoader />;
  const s = me.stats;
  const avg = (key: "clarity" | "relevance" | "persuasiveness" | "conciseness") => {
    const fb = history.data?.feedback ?? [];
    return fb.length ? (fb.reduce((a, f) => a + f[key], 0) / fb.length).toFixed(1) : "-";
  };

  const saveName = async () => {
    try {
      await api("/me", { method: "PATCH", body: { displayName: name } });
      await reload();
      setEditing(false);
      toast("Display name updated.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update name.", "error");
    }
  };

  return (
    <div className="bg-paper-grain">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="bg-chamber flex flex-col gap-6 rounded-3xl p-8 text-paper shadow-lift sm:flex-row sm:items-center">
          <Avatar name={me.user.displayName} src={me.user.imageUrl} size={88} ring />
          <div className="min-w-0 flex-1">
            <Eyebrow>Delegate profile</Eyebrow>
            {editing ? (
              <div className="mt-2 flex max-w-sm gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.displayName} autoFocus className="text-ink-800" />
                <Button variant="brass" onClick={saveName} disabled={name.trim().length < 2} icon={<Check className="size-4" />} />
                <Button variant="light" onClick={() => setEditing(false)} icon={<X className="size-4" />} />
              </div>
            ) : (
              <h1 className="mt-1 flex items-center gap-3 text-4xl font-semibold">
                {me.user.displayName}
                <button
                  onClick={() => {
                    setName(me.user.displayName);
                    setEditing(true);
                  }}
                  className="rounded-lg p-1.5 text-paper/40 hover:bg-white/10 hover:text-paper"
                  title="Edit display name"
                >
                  <Pencil className="size-4" />
                </button>
              </h1>
            )}
            <p className="mt-1 text-sm text-paper/60">
              {me.rank ? `Ranked #${me.rank} in the General Assembly` : "Finish a ranked game to enter the rankings"}
              {me.user.isAdmin && " · Administrator"}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl font-semibold text-brass-400">{s?.points ?? 0}</div>
            <div className="text-xs uppercase tracking-wider text-paper/50">points</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Games played" value={s?.gamesPlayed ?? 0} icon={<History className="size-3.5" />} />
          <StatTile label="Rooms won" value={s?.gamesWon ?? 0} icon={<Crown className="size-3.5" />} />
          <StatTile label="Rounds won" value={s?.roundsWon ?? 0} icon={<Trophy className="size-3.5" />} />
          <StatTile label="Votes received" value={s?.votesReceived ?? 0} icon={<Vote className="size-3.5" />} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <ScrollText className="size-5 text-brass" /> Recent sessions
            </h2>
            <Card className="mt-4 divide-y divide-ink-700/5">
              {history.loading && !history.data ? (
                <PageLoader />
              ) : history.data?.games.length ? (
                history.data.games.map((g) => (
                  <Link key={g.roomId} to={`/replay/${g.roomId}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-paper">
                    <span className={g.isWinner ? "text-brass" : "text-ink-300"}>{g.isWinner ? <Crown className="size-5" /> : <ScrollText className="size-5" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{g.name}</div>
                      <div className="text-xs text-ink-400">
                        {timeAgo(g.finishedAt)} · {g.roundWins}/{g.roundsTotal} rounds · {g.votesReceived} votes
                      </div>
                    </div>
                    {g.isWinner && <Badge tone="brass">Won</Badge>}
                    {!g.ranked && <Badge>Unranked</Badge>}
                  </Link>
                ))
              ) : (
                <EmptyState icon={<History className="size-6" />} title="No sessions yet">
                  <Link to="/play" className="font-medium text-brass-700 hover:underline">
                    Play your first game
                  </Link>{" "}
                  to start building your record.
                </EmptyState>
              )}
            </Card>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Sparkles className="size-5 text-brass" /> Coaching
            </h2>
            {history.data?.feedback.length ? (
              <>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {(
                    [
                      ["Clarity", "clarity"],
                      ["Relevance", "relevance"],
                      ["Persuasion", "persuasiveness"],
                      ["Concision", "conciseness"],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={key} className="rounded-2xl bg-white p-3 text-center shadow-card">
                      <div className="font-display text-2xl font-semibold">{avg(key)}</div>
                      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-4">
                  {history.data.feedback.slice(0, 5).map((f) => (
                    <CoachingCard key={f.id} feedback={f} compact />
                  ))}
                </div>
              </>
            ) : (
              <Card className="mt-4">
                <EmptyState icon={<Sparkles className="size-6" />} title="No coaching cards yet">
                  Every finished game ends with a personal card on how you argued.
                </EmptyState>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
