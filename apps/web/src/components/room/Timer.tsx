import { PHASE_DURATIONS, type Phase } from "@mun/shared";
import { cn } from "../../lib/cn";
import { formatClock, useCountdown } from "../../lib/time";

/** Circular countdown driven by the server's phase deadline. */
export function PhaseTimer({ phase, endsAt, offset, size = 64 }: { phase: Phase; endsAt: number | null; offset: number; size?: number }) {
  const remaining = useCountdown(endsAt, offset);
  const total = (PHASE_DURATIONS[phase as keyof typeof PHASE_DURATIONS] ?? 60) * 1000;
  const pct = endsAt ? Math.min(1, remaining / total) : 0;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const urgent = endsAt !== null && remaining < 10_000;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-[stroke-dashoffset] duration-200 ease-linear", urgent ? "stroke-crimson" : "stroke-brass")}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-mono font-semibold tabular-nums",
          urgent ? "text-crimson" : "text-paper",
          size >= 64 ? "text-sm" : "text-xs",
        )}
      >
        {endsAt ? formatClock(remaining) : "--"}
      </span>
    </div>
  );
}

const STEPS: { phase: Phase; label: string }[] = [
  { phase: "agenda", label: "Agenda" },
  { phase: "debate", label: "Debate" },
  { phase: "drafting", label: "Draft" },
  { phase: "voting", label: "Vote" },
  { phase: "reveal", label: "Reveal" },
];

export function PhaseStepper({ phase }: { phase: Phase }) {
  const idx = STEPS.findIndex((s) => s.phase === phase);
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <li key={s.phase} className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition",
              i === idx ? "bg-brass text-ink-900" : i < idx || phase === "finished" ? "text-paper/70" : "text-paper/30",
            )}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className={cn("h-px w-3", i < idx ? "bg-paper/40" : "bg-paper/15")} />}
        </li>
      ))}
    </ol>
  );
}
