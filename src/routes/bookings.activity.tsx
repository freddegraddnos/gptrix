import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Inbox, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { slotEventLabel, type SlotEvent } from "@/lib/slotEvents";
import { BookingDeliveryLog } from "@/components/BookingDeliveryLog";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/bookings/activity")({
  head: () => ({
    meta: [
      { title: tx("Booking updates — InkSimulator") },
      {
        name: "description",
        content:
          "Every status change, proposed time and decline reason for your tattoo bookings, newest first.",
      },
      { property: "og:title", content: "Booking updates — InkSimulator" },
      {
        property: "og:description",
        content: "Follow requests, proposals and confirmations from your studios in one place.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <RequireAuth requireVerified title={tx("Sign in to see booking updates")} description={tx("Status changes and proposed times are tied to your account.")}>
      <BookingActivityPage />
    </RequireAuth>
  ),
});

type Row = SlotEvent & {
  studio_slots: { starts_at: string; duration_minutes: number; status: string } | null;
};

function BookingActivityPage() {
  useUiLang();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("slot_events")
        .select("*, studio_slots(starts_at, duration_minutes, status)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!alive) return;
      if (err) setError(err.message);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const list = map.get(r.slot_id) ?? [];
      list.push(r);
      map.set(r.slot_id, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
        <h1 className="text-2xl font-black tracking-tight">{tx("Booking updates")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx("Requests, proposed times, decline reasons and confirmations — newest first.")}
        </p>

        {!authLoading && !user && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-sm text-muted-foreground">{tx("Sign in to see your booking updates.")}</p>
            <Link
              to="/auth"
              className="mt-3 inline-block rounded-xl bg-accent px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-black"
            >
              {tx("Sign in")}
            </Link>
          </div>
        )}

        {user && loading && (
          <div className="mt-10 flex justify-center">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        )}

        {error && <p className="mt-6 text-sm text-destructive">{tx("Could not load updates:")}{" "}{error}</p>}

        {user && !loading && rows.length === 0 && !error && (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <Inbox className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {tx("No updates yet. When you request a time, every step shows up here.")}
            </p>
            <Link
              to="/studios"
              className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-black"
            >
              {tx("Find a studio")}
            </Link>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {groups.map(([slotId, events]) => (
            <section key={slotId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {events[0]?.studio_slots
                  ? `Appointment ${new Date(events[0].studio_slots.starts_at).toLocaleString()}`
                  : tx("Appointment")}
              </h2>
              <ol className="mt-3 space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{slotEventLabel(e)}</p>
                      {e.note && <p className="mt-0.5 text-[12px] text-accent">{e.note}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <BookingDeliveryLog slotId={slotId} />
            </section>
          ))}
        </div>

        <Link
          to="/bookings"
          className="mt-6 inline-block text-[11px] font-bold uppercase tracking-widest text-accent"
        >
          {tx("Back to my bookings")}
        </Link>
      </div>
    </AppShell>
  );
}
