import { motion } from "motion/react";
import { Crown, Medal, Trophy } from "lucide-react";
import { SCORING } from "@mun/shared";
import { Avatar, Card, EmptyState, ErrorNote, Eyebrow, PageLoader } from "../components/ui";
import { useFetch } from "../lib/api";
import { cn } from "../lib/cn";
import { useMe } from "../lib/me";
import type { LeaderboardRow } from "../lib/types";

export default function Leaderboard() {
  const { data, loading, error } = useFetch<{ rows: LeaderboardRow[] }>("/leaderboard?limit=100");
  const { me } = useMe();
  const rows = data?.rows ?? [];
  const podium = rows.slice(0, 3);

  return (
    <div className="bg-paper-grain">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Eyebrow>Global rankings</Eyebrow>
        <h1 className="mt-2 text-4xl font-semibold">The General Assembly</h1>
        <p className="mt-2 max-w-2xl text-ink-500">
          {SCORING.roundWin} point per round won, {SCORING.gameWin} bonus points per room won. Ties are broken by total votes received, then
          by fewest rounds without a vote. Only ranked rooms count.
        </p>

        {loading && <PageLoader />}
        {error && <div className="mt-6"><ErrorNote>{error}</ErrorNote></div>}

        {!loading && !error && rows.length === 0 && (
          <Card className="mt-8">
            <EmptyState icon={<Trophy className="size-6" />} title="No ranked games yet">
              Finish a game with enough delegates and the first names will appear here.
            </EmptyState>
          </Card>
        )}

        {podium.length > 0 && (
          <div className="mt-10 grid grid-cols-3 items-end gap-3 sm:gap-5">
            {[podium[1], podium[0], podium[2]].map((r, i) =>
              r ? (
                <motion.div
                  key={r.userId}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "flex flex-col items-center rounded-3xl p-5 text-center",
                    r.rank === 1 ? "bg-chamber pb-10 text-paper shadow-lift" : "bg-white shadow-card",
                  )}
                >
                  {r.rank === 1 ? <Crown className="mb-2 size-7 text-brass-400" /> : <Medal className={cn("mb-2 size-6", r.rank === 2 ? "text-ink-400" : "text-brass-600")} />}
                  <Avatar name={r.displayName} src={r.imageUrl} size={r.rank === 1 ? 72 : 56} ring={r.rank === 1} />
                  <div className="mt-3 w-full truncate font-semibold">{r.displayName}</div>
                  <div className={cn("font-display text-3xl font-semibold", r.rank === 1 ? "text-brass-400" : "text-ink-700")}>{r.points}</div>
                  <div className={cn("text-xs", r.rank === 1 ? "text-paper/60" : "text-ink-400")}>
                    {r.gamesWon} rooms · {r.roundsWon} rounds
                  </div>
                </motion.div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>
        )}

        {rows.length > 0 && (
          <Card className="mt-8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-paper text-left text-xs uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Delegate</th>
                    <th className="px-5 py-3 text-right">Points</th>
                    <th className="px-5 py-3 text-right">Rooms won</th>
                    <th className="px-5 py-3 text-right">Rounds won</th>
                    <th className="px-5 py-3 text-right">Votes</th>
                    <th className="px-5 py-3 text-right">Games</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId} className={cn("border-t border-ink-700/5", r.userId === me?.user.id && "bg-brass-100/60")}>
                      <td className="px-5 py-3 font-display text-lg font-semibold text-ink-400">{r.rank}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.displayName} src={r.imageUrl} size={30} />
                          <span className="font-medium">{r.displayName}</span>
                          {r.userId === me?.user.id && <span className="text-xs text-brass-700">(you)</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{r.points}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.gamesWon}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.roundsWon}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.votesReceived}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink-400">{r.gamesPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
