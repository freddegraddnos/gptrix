import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EyeOff, Loader2, Pencil, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { StudioShell } from "@/components/StudioShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useArtistMode } from "@/hooks/useArtistMode";
import { useStudioClients, type StudioClient } from "@/hooks/useStudioClients";
import { setStudioClientState, upsertStudioClient } from "@/lib/studioClients.functions";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/clients/list")({
  head: () => ({
    meta: [
      { title: tx("Clients — InkSimulator Artist") },
      { name: "description", content: "Manage your studio's clients: edit details, hide them or end the relationship." },
      { property: "og:title", content: "Studio clients — InkSimulator" },
      { property: "og:description", content: "One row per client with projects, contact details and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <RequireAuth requireVerified title={tx("Sign in to manage clients")}><ClientsPage /></RequireAuth>,
});

const STATE_LABEL = { active: "Active", hidden: "Hidden", ended: "Ended" } as const;

function ClientsPage() {
  useUiLang();
  const { user } = useAuth();
  const { artist } = useArtistMode(user?.id);
  const studioId = artist?.user_id;
  const { clients, loading, refresh } = useStudioClients(studioId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"active" | "hidden" | "ended" | "all">("active");
  const [editing, setEditing] = useState<StudioClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });

  const filtered = useMemo(() => clients.filter((client) => {
    const haystack = `${client.name} ${client.handle ?? ""} ${client.email ?? ""} ${client.phone ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (filter === "all" || client.state === filter);
  }), [clients, query, filter]);

  const openEdit = (client: StudioClient) => {
    setEditing(client);
    setForm({ name: client.name, email: client.email ?? "", phone: client.phone ?? "", note: client.note ?? "" });
  };

  const save = async () => {
    if (!editing || !studioId) return;
    setBusy(true);
    try {
      await upsertStudioClient({ data: {
        studioId,
        clientKey: editing.key,
        clientUserId: editing.clientUserId,
        displayName: form.name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        note: form.note.trim() || null,
      } });
      toast.success(tx("Client updated"));
      setEditing(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save client");
    }
    setBusy(false);
  };

  const changeState = async (client: StudioClient, state: "active" | "hidden" | "ended") => {
    if (!studioId) return;
    if (state === "ended" && !window.confirm(tx("End the relationship? Open projects are archived. Messages, sketches, bookings and paid deposits are kept."))) return;
    setBusy(true);
    try {
      await setStudioClientState({ data: {
        studioId,
        clientKey: client.key,
        clientUserId: client.clientUserId,
        state,
        projectIds: client.projects.map((project) => project.id),
      } });
      toast.success(state === "active" ? "Client reopened" : state === "hidden" ? "Client hidden" : "Relationship ended");
      setEditing(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update client");
    }
    setBusy(false);
  };

  return <StudioShell current="clients">
    <p className="-mt-3 text-sm text-muted-foreground">{tx("Everyone you work with, and the projects behind them.")}</p>

    <section className="my-5 grid gap-2 sm:grid-cols-[1fr_auto]">
      <label className="relative">
        <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx("Search name, username, email or phone")} className="h-11 w-full rounded-md border border-border bg-secondary pl-10 pr-3 text-sm outline-none focus:border-accent" />
      </label>
      <select aria-label={tx("Filter clients")} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-11 rounded-md border border-border bg-secondary px-3 text-sm">
        <option value="active">{tx("Active")}</option>
        <option value="hidden">{tx("Hidden")}</option>
        <option value="ended">{tx("Ended")}</option>
        <option value="all">{tx("All")}</option>
      </select>
    </section>

    {loading ? <div className="grid py-20 place-items-center"><Loader2 className="size-5 animate-spin text-accent" /></div>
      : filtered.length === 0 ? <div className="border-y border-dashed border-border py-16 text-center text-sm text-muted-foreground">{tx("No clients match these filters.")}</div>
      : <div className="divide-y divide-border border-y border-border">
        {filtered.map((client) => <article key={client.key} className="py-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-sm font-bold text-accent">{client.name[0]?.toUpperCase() ?? <UserRound className="size-4" />}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{client.name}</p>
              <p className="truncate text-xs text-muted-foreground">{[client.handle ? `@${client.handle}` : null, client.email, client.phone].filter(Boolean).join(" · ") || tx("No contact details")}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{client.projects.length} project{client.projects.length === 1 ? "" : "s"}{" "}{tx("· Latest activity")}{" "}{new Date(client.latestActivity).toLocaleDateString()}</p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${client.state === "active" ? "bg-emerald-500/10 text-emerald-300" : client.state === "hidden" ? "bg-secondary text-muted-foreground" : "bg-amber-500/10 text-amber-300"}`}>{STATE_LABEL[client.state]}</span>
          </div>
          <ul className="mt-3 space-y-1 pl-14">
            {client.projects.map((project) => <li key={project.id}>
              <Link to="/artists/requests/$id" params={{ id: project.id }} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-accent">{project.conversation_title || project.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{project.status.replace(/_/g, " ")}</span>
              </Link>
            </li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 pl-14">
            <Button type="button" size="sm" variant="outline" onClick={() => openEdit(client)}><Pencil className="size-3.5" />{tx("Edit")}</Button>
            {client.state === "active" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void changeState(client, "hidden")}><EyeOff className="size-3.5" />{tx("Hide")}</Button>}
            {client.state !== "ended" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void changeState(client, "ended")}>{tx("End relationship")}</Button>}
            {client.state !== "active" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void changeState(client, "active")}>{tx("Reopen")}</Button>}
          </div>
        </article>)}
      </div>}

    {editing && <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center" role="dialog" aria-modal="true" aria-label={tx("Edit client")}>
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-background p-5 sm:rounded-2xl">
        <h2 className="font-display text-lg font-bold">{tx("Edit client")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{tx("Only changes how this client looks in your studio. Their own account is untouched.")}</p>
        <div className="mt-4 space-y-3">
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Name")}</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-accent" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Email")}</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-accent" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Phone")}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-accent" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Private note")}</span><textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full rounded-md border border-border bg-secondary p-3 text-sm outline-none focus:border-accent" /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" className="flex-1" disabled={busy} onClick={() => void save()}>{tx("Save")}</Button>
          <Button type="button" variant="outline" onClick={() => setEditing(null)}>{tx("Cancel")}</Button>
        </div>
      </div>
    </div>}
  </StudioShell>;
}
