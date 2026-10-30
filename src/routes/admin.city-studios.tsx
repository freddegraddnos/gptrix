import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { AdminGate } from "@/components/AdminGate";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/city-studios")({
  head: () => ({
    meta: [
      { title: "Studiobesök från stadssidor — InkSimulator admin" },
      { name: "description", content: "Vilka studios som får klick från stadssidorna." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Studiobesök från stadssidor — InkSimulator admin" },
      { property: "og:description", content: "Klick till studios från /sv/tatuerare-sidorna." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <TopBar title="Stadssidor" />
      <main className="space-y-4 pb-24">
        <h1 className="font-display text-2xl font-bold tracking-tight">Studiobesök från stadssidor</h1>
        <AdminGate><Report /></AdminGate>
      </main>
    </AppShell>
  ),
});

type Row = { anon_id: string | null; user_id: string | null; created_at: string; meta: { handle?: string; city?: string } | null };

function Report() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [days, setDays] = useState(30);
  useEffect(() => {
    setRows(null);
    const since = new Date(Date.now() - days * 864e5).toISOString();
    void (async () => {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("analytics_events")
          .select("anon_id, user_id, created_at, meta")
          .eq("event", "city_studio_clicked")
          .gte("created_at", since)
          .range(from, from + 999);
        if (error || !data) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      setRows(all);
    })();
  }, [days]);

  if (!rows) return <p className="text-sm text-muted-foreground">Laddar…</p>;

  const groups = new Map<string, { handle: string; city: string; clicks: number; people: Set<string>; last: string }>();
  for (const r of rows) {
    const handle = r.meta?.handle ?? "?";
    const city = r.meta?.city ?? "?";
    const key = `${handle}|${city}`;
    const g = groups.get(key) ?? { handle, city, clicks: 0, people: new Set<string>(), last: r.created_at };
    g.clicks++;
    g.people.add(r.user_id ?? r.anon_id ?? "?");
    if (r.created_at > g.last) g.last = r.created_at;
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.clicks - a.clicks);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`min-h-[44px] rounded-lg border-2 px-3 text-xs ${d === days ? "border-accent text-accent" : "border-border"}`}>
            {d} dagar
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga klick ännu under perioden. Klick sparas från och med nu.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="py-2">Studio</th><th>Stad</th><th>Klick</th><th>Besökare</th><th>Senast</th></tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={`${g.handle}|${g.city}`} className="border-t border-border">
                <td className="py-2"><a className="underline" href={`/${g.handle}`}>{g.handle}</a></td>
                <td>{g.city}</td>
                <td>{g.clicks}</td>
                <td>{g.people.size}</td>
                <td>{new Date(g.last).toLocaleDateString("sv-SE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
