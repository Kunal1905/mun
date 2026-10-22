import { Archive, ArchiveRestore, CheckCircle2, Flag, ListPlus, Pencil, Plus, RotateCcw, Shield } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AGENDA_CATEGORIES } from "@mun/shared";
import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, Field, Input, Modal, PageLoader, Segmented, StatTile, Textarea } from "../components/ui";
import { useApi, useFetch } from "../lib/api";
import { categoryLabel, cn } from "../lib/cn";
import { timeAgo } from "../lib/time";
import { useToast } from "../lib/toast";

interface AgendaRow {
  id: string;
  title: string;
  brief: string;
  category: string;
  stakeholders: string[];
  twist: string | null;
  status: "active" | "archived";
}
interface ReportRow {
  id: string;
  targetType: string;
  targetText: string;
  reason: string;
  status: string;
  createdAt: string;
  reporterName: string;
}

export default function Admin() {
  const [tab, setTab] = useState<"reports" | "agendas">("reports");
  const overview = useFetch<{ users: number; gamesFinished: number; openReports: number; activeAgendas: number; liveRooms: number; playersOnline: number }>("/admin/overview");
  const o = overview.data;

  return (
    <div className="bg-paper-grain">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Eyebrow>Secretariat</Eyebrow>
        <h1 className="mt-2 flex items-center gap-3 text-4xl font-semibold">
          <Shield className="size-7 text-brass" /> Admin console
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          <StatTile label="Delegates" value={o?.users ?? "-"} />
          <StatTile label="Online now" value={o?.playersOnline ?? "-"} />
          <StatTile label="Live rooms" value={o?.liveRooms ?? "-"} />
          <StatTile label="Games finished" value={o?.gamesFinished ?? "-"} />
          <StatTile label="Active agendas" value={o?.activeAgendas ?? "-"} />
          <StatTile label="Open reports" value={o?.openReports ?? "-"} />
        </div>

        <div className="mt-8 max-w-xs">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "reports", label: "Reports" },
              { value: "agendas", label: "Agenda pool" },
            ]}
          />
        </div>

        <div className="mt-6">{tab === "reports" ? <Reports onChange={overview.reload} /> : <Agendas onChange={overview.reload} />}</div>
      </div>
    </div>
  );
}

function Reports({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const { data, loading, error, reload } = useFetch<{ reports: ReportRow[] }>(`/admin/reports?status=${status}`);
  const api = useApi();
  const toast = useToast();

  const setReportStatus = async (id: string, next: "open" | "resolved") => {
    try {
      await api(`/admin/reports/${id}`, { method: "PATCH", body: { status: next } });
      await reload();
      onChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed.", "error");
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-700/5 px-5 py-3">
        <h2 className="text-lg font-semibold">Reported content</h2>
        <div className="w-56">
          <Segmented value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }]} />
        </div>
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <div className="p-5"><ErrorNote>{error}</ErrorNote></div>
      ) : !data?.reports.length ? (
        <EmptyState icon={<Flag className="size-6" />} title={status === "open" ? "Nothing to review" : "No resolved reports"}>
          Reports from players about speeches, resolutions and chat messages appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-ink-700/5">
          {data.reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                  <Badge tone="crimson">{r.targetType.replace("_", " ")}</Badge>
                  reported by {r.reporterName} · {timeAgo(r.createdAt)}
                </div>
                <blockquote className="mt-2 rounded-xl bg-paper p-3 text-sm italic">"{r.targetText}"</blockquote>
                <p className="mt-2 text-sm text-ink-600">
                  <span className="font-semibold">Reason:</span> {r.reason}
                </p>
              </div>
              {r.status === "open" ? (
                <Button size="sm" variant="outline" onClick={() => setReportStatus(r.id, "resolved")} icon={<CheckCircle2 className="size-4" />}>
                  Mark resolved
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setReportStatus(r.id, "open")} icon={<RotateCcw className="size-4" />}>
                  Reopen
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Agendas({ onChange }: { onChange: () => void }) {
  const { data, loading, error, reload } = useFetch<{ agendas: AgendaRow[] }>("/admin/agendas");
  const api = useApi();
  const toast = useToast();
  const [editing, setEditing] = useState<AgendaRow | "new" | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const toggle = async (a: AgendaRow) => {
    try {
      await api(`/admin/agendas/${a.id}`, { method: "PATCH", body: { status: a.status === "active" ? "archived" : "active" } });
      await reload();
      onChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed.", "error");
    }
  };

  const rows = (data?.agendas ?? []).filter((a) => filter === "all" || a.category === filter);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["all", ...AGENDA_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn("rounded-full px-3 py-1 text-sm font-medium", filter === c ? "bg-ink-700 text-paper" : "bg-white text-ink-500 shadow-card")}
          >
            {c === "all" ? "All" : categoryLabel(c)}
          </button>
        ))}
        <Button className="ml-auto" variant="brass" size="sm" onClick={() => setEditing("new")} icon={<Plus className="size-4" />}>
          New agenda
        </Button>
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ListPlus className="size-6" />} title="No agendas in this category" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id} className={cn("p-5", a.status === "archived" && "opacity-60")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex gap-1.5">
                    <Badge tone="brass">{categoryLabel(a.category)}</Badge>
                    {a.status === "archived" && <Badge>Archived</Badge>}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{a.title}</h3>
                </div>
                <button onClick={() => setEditing(a)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-700/5" title="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => toggle(a)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-700/5" title={a.status === "active" ? "Archive" : "Restore"}>
                  {a.status === "active" ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink-500">{a.brief}</p>
              <p className="mt-2 truncate text-xs text-ink-400">{a.stakeholders.join(" · ")}</p>
            </Card>
          ))}
        </div>
      )}
      <AgendaEditor
        agenda={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
          onChange();
        }}
      />
    </>
  );
}

function AgendaEditor({ agenda, onClose, onSaved }: { agenda: AgendaRow | "new" | null; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const existing = agenda && agenda !== "new" ? agenda : null;
  const key = existing?.id ?? (agenda ? "new" : "closed");
  return (
    <Modal open={!!agenda} onClose={onClose} title={existing ? "Edit agenda" : "New agenda"} wide>
      {agenda && <AgendaForm key={key} existing={existing} api={api} onSaved={onSaved} onClose={onClose} />}
    </Modal>
  );
}

function AgendaForm({
  existing,
  api,
  onSaved,
  onClose,
}: {
  existing: AgendaRow | null;
  api: ReturnType<typeof useApi>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [brief, setBrief] = useState(existing?.brief ?? "");
  const [category, setCategory] = useState(existing?.category ?? AGENDA_CATEGORIES[0]);
  const [stakeholders, setStakeholders] = useState(existing?.stakeholders.join(", ") ?? "");
  const [twist, setTwist] = useState(existing?.twist ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title,
      brief,
      category,
      twist: twist || null,
      stakeholders: stakeholders.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (existing) await api(`/admin/agendas/${existing.id}`, { method: "PATCH", body });
      else await api("/admin/agendas", { body });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Brief">
        <Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} required />
      </Field>
      <Field label="Category">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded-xl border border-ink-700/15 bg-white px-3 text-sm">
          {AGENDA_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Delegations (comma-separated)" hint="Players are assigned one of these at the start of each round.">
        <Input value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} placeholder="India, China, European Union, ..." required />
      </Field>
      <Field label="Crisis twist (optional)" hint="Revealed when drafting opens.">
        <Textarea rows={2} value={twist} onChange={(e) => setTwist(e.target.value)} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="brass" loading={busy}>
          Save agenda
        </Button>
      </div>
    </form>
  );
}
