import { motion } from "motion/react";
import { CalendarDays, Check, Crown, Flag, PenLine, Send, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LIMITS } from "@mun/shared";
import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, Field, Modal, PageLoader, Textarea } from "../components/ui";
import { useApi, useFetch } from "../lib/api";
import { categoryLabel, cn } from "../lib/cn";
import { useToast } from "../lib/toast";

interface DailyResponse {
  date: string;
  agenda: { id: string; title: string; brief: string; category: string };
  entries: { id: string; text: string; isMine: boolean; displayName: string | null; votes: number | null }[];
  myEntry: string | null;
  myVote: string | null;
  yesterdayWinner: { agendaTitle: string; displayName: string; text: string; votes: number } | null;
}

export default function Daily() {
  const { data, loading, error, reload } = useFetch<DailyResponse>("/daily");
  const api = useApi();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [reporting, setReporting] = useState<{ id: string; text: string } | null>(null);
  const [reason, setReason] = useState("");

  if (loading && !data) return <PageLoader />;
  if (error || !data)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorNote>{error ?? "Could not load today's crisis."}</ErrorNote>
      </div>
    );

  const revealed = !!data.myVote;
  const others = data.entries.filter((e) => !e.isMine);
  const dateLabel = new Date(`${data.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/daily/entry", { body: { text } });
      toast("Resolution entered into today's crisis.", "success");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not submit.", "error");
    } finally {
      setBusy(false);
    }
  };

  const vote = async (entryId: string) => {
    setVoting(entryId);
    try {
      await api("/daily/vote", { body: { entryId } });
      toast("Vote cast. Authors and tallies are now revealed.", "success");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not vote.", "error");
    } finally {
      setVoting(null);
    }
  };

  return (
    <div className="bg-paper-grain">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Eyebrow>Daily crisis · {dateLabel}</Eyebrow>

        <div className="bg-chamber mt-4 rounded-3xl p-8 text-paper shadow-lift">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="dark">
              <CalendarDays className="size-3" /> One resolution per delegate
            </Badge>
            <Badge tone="brass">{categoryLabel(data.agenda.category)}</Badge>
            <span className="ml-auto flex items-center gap-1.5 text-sm text-paper/60">
              <Users className="size-4" /> {data.entries.length} entries
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold text-balance">{data.agenda.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-paper/70">{data.agenda.brief}</p>
        </div>

        {data.yesterdayWinner && (
          <Card className="mt-5 flex items-start gap-4 p-5">
            <Crown className="mt-0.5 size-5 shrink-0 text-brass" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">Yesterday's winner · {data.yesterdayWinner.agendaTitle}</div>
              <p className="mt-1 font-display text-lg">"{data.yesterdayWinner.text}"</p>
              <p className="mt-1 text-sm text-ink-500">
                {data.yesterdayWinner.displayName} · {data.yesterdayWinner.votes} votes
              </p>
            </div>
          </Card>
        )}

        <div className="mt-8">
          {data.myEntry ? (
            <Card className="flex items-start gap-4 border-sage/30 bg-sage-100/40 p-5">
              <Check className="mt-1 size-5 text-sage" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-sage">Your resolution is in</div>
                <p className="mt-1 font-display text-lg">"{data.myEntry}"</p>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <form onSubmit={submit} className="space-y-4">
                <Field label="Your one-line resolution" hint={`${text.length}/${LIMITS.resolution} characters. You can only submit once.`}>
                  <Textarea
                    rows={2}
                    value={text}
                    onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
                    maxLength={LIMITS.resolution}
                    placeholder="The Security Council mandates..."
                    className="font-display text-lg"
                  />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" variant="brass" loading={busy} disabled={text.trim().length < 8} icon={<Send className="size-4" />}>
                    Submit to the Assembly
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <PenLine className="size-5 text-brass" /> {revealed ? "Results so far" : "Cast your vote"}
            </h2>
            {!revealed && others.length > 0 && <span className="text-sm text-ink-400">Authors are hidden until you vote</span>}
          </div>

          {others.length === 0 ? (
            <Card className="mt-4">
              <EmptyState icon={<Users className="size-6" />} title="No rival resolutions yet">
                Check back later - every delegate who plays today adds one.
              </EmptyState>
            </Card>
          ) : (
            <div className="mt-4 space-y-3">
              {data.entries.map((e, i) => {
                const max = Math.max(1, ...data.entries.map((x) => x.votes ?? 0));
                const chosen = data.myVote === e.id;
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn("group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-card", chosen ? "border-brass" : "border-ink-700/10")}
                  >
                    {revealed && (
                      <motion.div className="absolute inset-y-0 left-0 bg-brass-100" initial={{ width: 0 }} animate={{ width: `${((e.votes ?? 0) / max) * 100}%` }} transition={{ duration: 0.7 }} />
                    )}
                    <div className="relative flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg leading-snug">{e.text}</p>
                        {(revealed || e.isMine) && <p className="mt-1 text-xs text-ink-400">{e.isMine ? "You" : e.displayName}</p>}
                      </div>
                      {!e.isMine && (
                        <button
                          onClick={() => setReporting({ id: e.id, text: e.text })}
                          className="text-ink-300 opacity-0 transition hover:text-crimson group-hover:opacity-100"
                          title="Report"
                        >
                          <Flag className="size-4" />
                        </button>
                      )}
                      {revealed ? (
                        <span className="font-display text-2xl font-semibold tabular-nums">{e.votes}</span>
                      ) : e.isMine ? (
                        <Badge>Yours</Badge>
                      ) : (
                        <Button size="sm" loading={voting === e.id} onClick={() => vote(e.id)}>
                          Vote
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Modal open={!!reporting} onClose={() => setReporting(null)} title="Report resolution">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reporting) return;
            try {
              await api("/reports", { body: { targetType: "daily_entry", targetId: reporting.id, targetText: reporting.text, reason } });
              toast("Thanks - the moderators will review it.", "success");
              setReporting(null);
              setReason("");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Could not send the report.", "error");
            }
          }}
        >
          <blockquote className="rounded-xl bg-paper-100 p-3 text-sm italic">"{reporting?.text}"</blockquote>
          <Field label="What's wrong?">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={LIMITS.reportReason} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="danger" disabled={reason.trim().length < 3}>
              Send report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
