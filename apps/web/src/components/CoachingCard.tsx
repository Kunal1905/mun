import { motion } from "motion/react";
import { Quote, Sparkles } from "lucide-react";
import type { FeedbackView } from "@mun/shared";
import { cn } from "../lib/cn";

const DIMENSIONS = [
  { key: "clarity", label: "Clarity" },
  { key: "relevance", label: "Relevance" },
  { key: "persuasiveness", label: "Persuasion" },
  { key: "conciseness", label: "Concision" },
] as const;

export function CoachingCard({ feedback, dark, compact }: { feedback: FeedbackView; dark?: boolean; compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-6", dark ? "bg-white/[0.04] text-paper ring-1 ring-white/10" : "bg-white shadow-card ring-1 ring-ink-700/5")}>
      <div className="flex items-center justify-between gap-3">
        <div className={cn("flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]", dark ? "text-brass-400" : "text-brass-700")}>
          <Sparkles className="size-4" /> Coaching card
        </div>
        <span className={cn("min-w-0 truncate text-[11px]", dark ? "text-paper/40" : "text-ink-400")}>
          {feedback.source === "ai" ? "AI coach" : "Chair's notes"} · {feedback.roomName}
        </span>
      </div>
      <p className={cn("mt-3 font-display text-lg leading-snug", dark ? "text-paper" : "text-ink-700")}>{feedback.summary}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DIMENSIONS.map((d, i) => {
          const score = feedback[d.key];
          return (
            <div key={d.key} className={cn("rounded-xl p-3", dark ? "bg-white/5" : "bg-paper")}>
              <div className={cn("text-xs font-medium", dark ? "text-paper/60" : "text-ink-500")}>{d.label}</div>
              <div className="font-display text-2xl font-semibold tabular-nums">
                {score}
                <span className={cn("text-sm font-normal", dark ? "text-paper/30" : "text-ink-300")}>/10</span>
              </div>
              <div className={cn("mt-2 h-1.5 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-ink-700/10")}>
                <motion.div
                  className={cn("h-full rounded-full", score >= 7 ? "bg-sage" : score >= 5 ? "bg-brass" : "bg-crimson")}
                  initial={{ width: 0 }}
                  animate={{ width: `${score * 10}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.08 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!compact && (
        <ul className="mt-5 space-y-2.5">
          {DIMENSIONS.map((d) => (
            <li key={d.key} className="flex gap-3 text-sm leading-relaxed">
              <span className={cn("w-24 shrink-0 font-semibold", dark ? "text-brass-400" : "text-brass-700")}>{d.label}</span>
              <span className={dark ? "text-paper/80" : "text-ink-600"}>{feedback.advice[d.key]}</span>
            </li>
          ))}
        </ul>
      )}

      {feedback.bestLine && (
        <blockquote className={cn("mt-5 flex gap-3 rounded-xl p-4 text-sm italic leading-relaxed", dark ? "bg-brass/10 text-paper/90" : "bg-brass-100 text-ink-700")}>
          <Quote className="size-4 shrink-0 text-brass" />
          <span>
            <span className="mb-1 block text-[11px] font-semibold not-italic uppercase tracking-wider text-brass">Your best line</span>
            {feedback.bestLine}
          </span>
        </blockquote>
      )}
    </div>
  );
}
