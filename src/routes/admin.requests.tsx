import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { AdminGate } from "@/components/AdminGate";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/requests")({
  head: () => ({
    meta: [
      { title: "Studio requests — InkSimulator admin" },
      { name: "description", content: "Every studio's customer requests and whether they have been read." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Studio requests — InkSimulator admin" },
      { property: "og:description", content: "Read and unread requests per studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <TopBar title="Requests" />
      <main className="space-y-4 pb-24">
        <h1 className="font-display text-2xl font-bold tracking-tight">Studio requests</h1>
        <AdminGate><Requests /></AdminGate>
      </main>
    </AppShell>
  ),
});

type Req = { id: string; artist_id: string; title: string; client_name: string | null; created_at: string; studio_read_at: string | null };

function Requests() {
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("artist_client_projects")
        .select("id, artist_id, title, client_name, created_at, studio_read_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data ?? []) as Req[];
      setReqs(list);
      const ids = [...new Set(list.map((r) => r.artist_id))];
      if (ids.length) {
        const { data: studios } = await supabase.from("artist_profiles").select("user_id, studio_name").in("user_id", ids);
        setNames(Object.fromEntries((studios ?? []).map((s) => [s.user_id, s.studio_name ?? "Studio"])));
      }
    })();
  }, []);

  if (!reqs) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const shown = unreadOnly ? reqs.filter((r) => !r.studio_read_at) : reqs;
  const unread = reqs.filter((r) => !r.studio_read_at).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p>{reqs.length} requests · <span className="text-accent">{unread} unread</span></p>
        <button type="button" onClick={() => setUnreadOnly((v) => !v)} className="min-h-11 rounded-md border border-border px-3 text-[11px] font-bold uppercase">
          {unreadOnly ? "Show all" : "Unread only"}
        </button>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-bold">{names[r.artist_id] ?? "Studio"}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.client_name ?? "Customer"} · {r.title}</span>
              <span className="block text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </span>
            <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase ${r.studio_read_at ? "bg-secondary text-muted-foreground" : "bg-accent/15 text-accent"}`}>
              {r.studio_read_at ? "Read" : "Unread"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
