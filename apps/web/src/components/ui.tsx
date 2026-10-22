import { AnimatePresence, motion } from "motion/react";
import { Loader2, X } from "lucide-react";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

// ------------------------------------------------------------------ Button

type Variant = "primary" | "brass" | "ghost" | "outline" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink-700 text-paper hover:bg-ink-800 shadow-card",
  brass: "bg-brass text-ink-900 hover:bg-brass-400 shadow-card",
  ghost: "text-ink-600 hover:bg-ink-700/5",
  outline: "border border-ink-700/15 bg-white/70 text-ink-700 hover:border-ink-700/30 hover:bg-white",
  danger: "bg-crimson text-white hover:bg-crimson/90",
  light: "bg-white/10 text-paper hover:bg-white/15 border border-white/10",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

// ------------------------------------------------------------------ Surfaces

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-ink-700/10 bg-white shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brass" | "sage" | "crimson" | "dark";
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink-700/5 text-ink-600",
    brass: "bg-brass-100 text-brass-700",
    sage: "bg-sage-100 text-sage",
    crimson: "bg-crimson-100 text-crimson",
    dark: "bg-white/10 text-paper/90",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em] text-brass", className)}>{children}</p>;
}

export function Avatar({ name, src, size = 36, ring }: { name: string; src?: string | null; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white", ring && "ring-2 ring-brass ring-offset-2 ring-offset-transparent")}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 30% 38%)` }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-brass", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-brass-100 text-brass-700">{icon}</div>
      <h3 className="text-lg font-semibold text-ink-700">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-crimson/20 bg-crimson-100 px-4 py-3 text-sm text-crimson">{children}</div>;
}

// ------------------------------------------------------------------ Forms

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-ink-700/15 bg-white px-3.5 text-sm text-ink-800 placeholder:text-ink-300 transition focus:border-brass focus:outline-none focus:ring-4 focus:ring-brass/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputBase, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(inputBase, "resize-none py-3 leading-relaxed", className)} {...rest} />;
});

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="flex rounded-xl bg-ink-700/5 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "bg-white text-ink-800 shadow-card" : "text-ink-500 hover:text-ink-700",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Modal

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className={cn("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper shadow-lift sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700/10 bg-paper/95 px-6 py-4 backdrop-blur">
              <h2 className="text-xl font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-700/5 hover:text-ink-700" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ Brand

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-ink-700 shadow-card ring-1 ring-white/10">
        <svg viewBox="0 0 64 64" className="size-6">
          <path d="M32 12 14 21v3h36v-3L32 12Zm-14 15v16h5V27h-5Zm11.5 0v16h5V27h-5ZM41 27v16h5V27h-5ZM14 46v5h36v-5H14Z" fill="#B8893B" />
        </svg>
      </span>
      <span className={cn("font-display text-xl font-semibold", light ? "text-paper" : "text-ink-700")}>
        MUN <span className="text-brass">Crisis</span>
      </span>
    </span>
  );
}

export function StatTile({ label, value, icon, dark }: { label: string; value: ReactNode; icon?: ReactNode; dark?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-4", dark ? "bg-white/5 ring-1 ring-white/10" : "bg-white shadow-card ring-1 ring-ink-700/5")}>
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", dark ? "text-paper/60" : "text-ink-400")}>
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 font-display text-3xl font-semibold tabular-nums", dark ? "text-paper" : "text-ink-700")}>{value}</div>
    </div>
  );
}
