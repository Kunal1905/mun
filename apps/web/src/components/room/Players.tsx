import { Check, Crown, Mic, UserX, WifiOff } from "lucide-react";
import type { RoomState } from "@mun/shared";
import { Avatar } from "../ui";
import { cn } from "../../lib/cn";

export function PlayerList({ state, onKick }: { state: RoomState; onKick?: (playerId: string) => void }) {
  const showStatus = state.phase === "drafting" || state.phase === "voting";
  return (
    <ul className="space-y-1.5">
      {state.players.map((p) => {
        const speaking = state.currentSpeakerId === p.id;
        const acted =
          (state.phase === "drafting" && state.submittedPlayerIds.includes(p.id)) ||
          (state.phase === "voting" && state.votedPlayerIds.includes(p.id));
        return (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 transition",
              speaking ? "bg-brass/15 ring-1 ring-brass/40" : "bg-white/[0.03]",
              !p.isConnected && "opacity-50",
            )}
          >
            <div className={cn("rounded-full", speaking && "animate-pulse-ring")}>
              <Avatar name={p.displayName} src={p.imageUrl} size={34} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-paper">
                <span className="truncate">{p.displayName}</span>
                {p.isHost && <Crown className="size-3.5 shrink-0 text-brass-400" aria-label="Host" />}
                {p.id === state.me?.playerId && <span className="text-[10px] uppercase tracking-wider text-paper/40">you</span>}
              </div>
              <div className="truncate text-xs text-paper/50">
                {p.delegation ?? (state.phase === "lobby" ? (p.isReady ? "Ready" : "Not ready") : "Delegate")}
              </div>
            </div>
            {!p.isConnected && <WifiOff className="size-4 text-paper/50" />}
            {speaking && <Mic className="size-4 text-brass-400" />}
            {showStatus && (
              <span className={cn("flex size-5 items-center justify-center rounded-full", acted ? "bg-sage text-white" : "bg-white/10")}>
                {acted && <Check className="size-3" />}
              </span>
            )}
            {state.phase === "lobby" && (
              <span className={cn("size-2 rounded-full", p.isReady ? "bg-emerald-400" : "bg-white/20")} />
            )}
            {state.phase !== "lobby" && state.phase !== "agenda" && p.roundWins > 0 && (
              <span className="rounded-full bg-brass/20 px-2 py-0.5 text-xs font-semibold text-brass-400">{p.roundWins}</span>
            )}
            {onKick && state.phase === "lobby" && !p.isHost && (
              <button onClick={() => onKick(p.id)} className="rounded-md p-1 text-paper/30 hover:bg-white/10 hover:text-crimson" title="Remove from room">
                <UserX className="size-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
