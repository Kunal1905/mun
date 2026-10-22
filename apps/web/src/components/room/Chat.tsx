import { Flag, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LIMITS, type ChatMessageView } from "@mun/shared";
import { cn } from "../../lib/cn";

export function ChatPanel({
  messages,
  myUserId,
  onSend,
  onReport,
}: {
  messages: ChatMessageView[];
  myUserId: string | undefined;
  onSend: (text: string) => void;
  onReport: (m: ChatMessageView) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText("");
    stick.current = true;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-2"
      >
        {messages.length === 0 && <p className="py-8 text-center text-sm text-paper/40">Say hello to the committee.</p>}
        {messages.map((m) =>
          m.kind === "system" ? (
            <div key={m.id} className="px-2 py-1 text-center text-xs italic text-brass-400/80">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={cn("group flex flex-col", m.userId === myUserId ? "items-end" : "items-start")}>
              <span className="mb-0.5 px-1 text-[11px] text-paper/40">{m.userId === myUserId ? "You" : m.displayName}</span>
              <div className="flex max-w-[90%] items-center gap-1">
                {m.userId !== myUserId && (
                  <button
                    onClick={() => onReport(m)}
                    className="order-2 rounded p-1 text-paper/20 opacity-0 transition hover:text-crimson group-hover:opacity-100"
                    title="Report message"
                  >
                    <Flag className="size-3" />
                  </button>
                )}
                <p
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm leading-snug break-words",
                    m.userId === myUserId ? "rounded-br-md bg-brass text-ink-900" : "rounded-bl-md bg-white/10 text-paper",
                  )}
                >
                  {m.text}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.chat}
          placeholder="Message the committee..."
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-paper placeholder:text-paper/30 focus:border-brass focus:outline-none"
        />
        <button type="submit" className="flex size-10 items-center justify-center rounded-xl bg-brass text-ink-900 transition hover:bg-brass-400 disabled:opacity-40" disabled={!text.trim()} aria-label="Send">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
