import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

type Kind = "info" | "error" | "success";
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-ink-800 px-4 py-3 text-sm text-paper shadow-lift"
            >
              {t.kind === "error" ? (
                <CircleAlert className="size-4 shrink-0 text-crimson" />
              ) : t.kind === "success" ? (
                <CircleCheck className="size-4 shrink-0 text-emerald-400" />
              ) : (
                <Info className="size-4 shrink-0 text-brass-400" />
              )}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
