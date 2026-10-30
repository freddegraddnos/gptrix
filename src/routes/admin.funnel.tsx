import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { AdminGate } from "@/components/AdminGate";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/funnel")({
  head: () => ({
    meta: [
      { title: "Funnel — InkSimulator admin" },
      { name: "description", content: "Where visitors drop off between AR, upload, save, share and studio." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Funnel — InkSimulator admin" },
      { property: "og:description", content: "Visitor funnel counts for the last 7 and 30 days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <TopBar title="Funnel" />
      <main className="space-y-4 pb-24">
        <h1 className="font-display text-2xl font-bold tracking-tight">Visitor funnel</h1>
        <AdminGate><Funnel /></AdminGate>
      </main>
    </AppShell>
  ),
});

const STEPS = [
  ["camera_prompt_shown", "Camera prompt shown"],
  ["camera_granted", "Camera granted"],
  ["camera_denied", "Camera denied"],
  ["tryon_started", "Try-on started"],
  ["tryon_completed", "Try-on completed (saved/shared)"],
  ["booking_started", "Booking started"],
  ["studio_contact_clicked", "Studio contact clicked"],
  ["booking_completed", "Booking completed"],
] as const;

type Row = { event: string; anon_id: string | null; user_id: string | null; created_at: string };

function Funnel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    void (async () => {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("analytics_events")
          .select("event, anon_id, user_id, created_at")
          .gte("created_at", since)
          .range(from, from + 999);
        if (error || !data) break;
        all.push(...data);
        if (data.length < 1000) break;
      }
      setRows(all);
    })();
  }, []);

  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const count = (days: number) => {
    const cut = Date.now() - days * 864e5;
    return STEPS.map(([key]) => {
      const people = new Set(
        rows.filter((r) => r.event === key && Date.parse(r.created_at) >= cut).map((r) => r.user_id ?? r.anon_id ?? "?"),
      );
      return people.size;
    });
  };
  const w7 = count(7);
  const w30 = count(30);

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">Unique visitors per step. Drop-off compares with the step above.</p>
      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-[10px] uppercase text-muted-foreground">
            <tr><th className="p-3">Step</th><th className="p-3 text-right">7 days</th><th className="p-3 text-right">30 days</th></tr>
          </thead>
          <tbody>
            {STEPS.map(([key, label], i) => (
              <tr key={key} className="border-t border-border">
                <td className="p-3 font-bold">{label}</td>
                <td className="p-3 text-right">{w7[i]}{i > 0 && w7[i - 1] ? <span className="ml-2 text-[10px] text-muted-foreground">{Math.round((w7[i] / w7[i - 1]) * 100)}%</span> : null}</td>
                <td className="p-3 text-right">{w30[i]}{i > 0 && w30[i - 1] ? <span className="ml-2 text-[10px] text-muted-foreground">{Math.round((w30[i] / w30[i - 1]) * 100)}%</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
