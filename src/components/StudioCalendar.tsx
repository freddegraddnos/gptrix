import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Ban, CalendarX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cancelStudioSession } from "@/lib/projectSessions.functions";
import { syncStudioCalendar } from "@/lib/studioCalendar.functions";

import { tx, useUiLang } from "@/lib/uiLang";
type Slot = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  member_id: string | null;
  source: string;
  note: string | null;
};

type SlotBooking = {
  slot_id: string;
  session_number: number;
  project_id: string | null;
  client: string;
  title: string | null;
  total: number | null;
};



const STATUS_STYLE: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  requested: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  proposed: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  booked: "bg-accent/15 text-accent border-accent/30",
  blocked: "bg-white/5 text-muted-foreground border-white/10",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Free",
  requested: "Requested",
  proposed: "Proposed",
  booked: "Booked",
  blocked: "Blocked",
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Month calendar for the studio: every generated time with its state, plus
 * day-level editing — add a single time, remove a free one, block a whole day
 * or cancel a booked session.
 */
export function StudioCalendar({ studioId }: { studioId: string }) {
  useUiLang();
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Record<string, SlotBooking>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(ymd(today));
  const [newTime, setNewTime] = useState("12:00");
  const [newLength, setNewLength] = useState(60);
  const [busy, setBusy] = useState(false);

  const from = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const to = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 1), [month]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("studio_slots")
      .select("id,starts_at,duration_minutes,status,member_id,source,note")
      .eq("studio_id", studioId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at");
    if (error) toast.error(tx("Could not load the calendar."));
    const list = (data ?? []) as Slot[];
    setSlots(list);

    const bookedIds = list.filter((s) => s.status === "booked").map((s) => s.id);
    if (bookedIds.length > 0) {
      const { data: rows } = await supabase
        .from("bookings")
        .select(
          "slot_id, session_number, artist_project_id, artist_client_projects(title, client_name, session_count)",
        )
        .eq("artist_id", studioId)
        .neq("status", "cancelled")
        .in("slot_id", bookedIds);
      const map: Record<string, SlotBooking> = {};
      for (const row of (rows ?? []) as Array<{
        slot_id: string | null;
        session_number: number | null;
        artist_project_id: string | null;
        artist_client_projects: { title: string | null; client_name: string | null; session_count: number | null } | null;
      }>) {
        if (!row.slot_id) continue;
        map[row.slot_id] = {
          slot_id: row.slot_id,
          session_number: row.session_number ?? 1,
          project_id: row.artist_project_id,
          client: row.artist_client_projects?.client_name ?? "Client",
          title: row.artist_client_projects?.title ?? null,
          total: row.artist_client_projects?.session_count ?? null,
        };
      }
      setBookings(map);
    } else {
      setBookings({});
    }
    setLoading(false);
  }, [studioId, from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Pull Google busy times when the studio opens the calendar, so a time that
  // is taken in Google can never be booked here. Silent when not connected.
  useEffect(() => {
    let cancelled = false;
    void syncStudioCalendar()
      .then((res) => {
        if (!cancelled && res && "linked" in res && res.linked && (res.blocked > 0 || res.released > 0)) {
          void refresh();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Runs once per studio — the calendar refreshes itself on month change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId]);


  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = ymd(new Date(s.starts_at));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [slots]);

  const daySlots = byDay.get(selected) ?? [];

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: Array<string | null> = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) out.push(ymd(new Date(month.getFullYear(), month.getMonth(), d)));
    return out;
  }, [month]);

  const addSlot = async () => {
    setBusy(true);
    try {
      const [h, m] = newTime.split(":").map(Number);
      const [y, mo, d] = selected.split("-").map(Number);
      const start = new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, m ?? 0, 0, 0);
      const { error } = await supabase.from("studio_slots").insert({
        studio_id: studioId,
        starts_at: start.toISOString(),
        duration_minutes: newLength,
      });
      if (error) throw error;
      toast.success(tx("Time added."));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the time.");
    } finally {
      setBusy(false);
    }
  };

  const removeSlot = async (slot: Slot) => {
    if (slot.status === "booked") {
      toast.error(tx("Cancel the session instead of deleting it."));
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("studio_slots").delete().eq("id", slot.id);
    if (error) toast.error(tx("Could not remove the time."));
    await refresh();
    setBusy(false);
  };

  const cancelBooked = async (slot: Slot) => {
    setBusy(true);
    try {
      await cancelStudioSession({ data: { slotId: slot.id } });
      toast.success(tx("Session cancelled — the customer is notified."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel the session.");
    }
    await refresh();
    setBusy(false);
  };


  const blockDay = async () => {
    setBusy(true);
    try {
      const open = daySlots.filter((s) => s.status === "open");
      if (open.length > 0) {
        const { error } = await supabase
          .from("studio_slots")
          .update({ status: "blocked" })
          .in("id", open.map((s) => s.id));
        if (error) throw error;
      }
      const [y, mo, d] = selected.split("-").map(Number);
      const start = new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, 9, 0, 0, 0);
      if (daySlots.length === 0) {
        const { error } = await supabase.from("studio_slots").insert({
          studio_id: studioId,
          starts_at: start.toISOString(),
          duration_minutes: 480,
          status: "blocked",
          note: "Closed",
        });
        if (error) throw error;
      }
      toast.success(tx("Day blocked."));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not block the day.");
    } finally {
      setBusy(false);
    }
  };

  const unblockDay = async () => {
    setBusy(true);
    const blocked = daySlots.filter((s) => s.status === "blocked" && s.source === "studio");
    if (blocked.length > 0) {
      await supabase.from("studio_slots").update({ status: "open" }).in("id", blocked.map((s) => s.id));
    }
    await refresh();
    setBusy(false);
  };

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={tx("Previous month")}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="grid size-9 place-items-center rounded-full border border-white/10"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h3 className="font-display text-base font-bold">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
          <button
            type="button"
            aria-label={tx("Next month")}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="grid size-9 place-items-center rounded-full border border-white/10"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[9px] uppercase tracking-widest text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <div key={`pad-${i}`} />;
            const list = byDay.get(key) ?? [];
            const free = list.filter((s) => s.status === "open").length;
            const booked = list.filter((s) => s.status === "booked").length;
            const pending = list.filter((s) => s.status === "requested" || s.status === "proposed").length;
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                className={`aspect-square rounded-lg border p-1 text-left transition ${
                  isSelected ? "border-accent bg-accent/10" : "border-white/10 bg-ink"
                }`}
              >
                <span className="text-[11px] font-bold">{Number(key.slice(8))}</span>
                <span className="mt-1 flex flex-wrap gap-0.5">
                  {free > 0 && <i className="size-1.5 rounded-full bg-emerald-400" />}
                  {pending > 0 && <i className="size-1.5 rounded-full bg-amber-400" />}
                  {booked > 0 && <i className="size-1.5 rounded-full bg-accent" />}
                </span>
              </button>
            );
          })}
        </div>
        {loading && (
          <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />{" "}{tx("Loading times…")}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-3">
        <h3 className="text-mono-caps text-[10px] text-muted-foreground">{selected}</h3>

        {daySlots.length === 0 && (
          <p className="text-xs text-muted-foreground">{tx("No times this day yet.")}</p>
        )}

        <ul className="space-y-2">
          {daySlots.map((s) => {
            const b = bookings[s.id];
            return (
            <li
              key={s.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                STATUS_STYLE[s.status] ?? STATUS_STYLE["blocked"]
              }`}
            >
              <div className="flex items-center justify-between gap-2">
              <span className="font-bold">
                {hhmm(s.starts_at)} · {s.duration_minutes} min
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest">
                  {s.source === "google" ? tx("Google") : (STATUS_LABEL[s.status] ?? s.status)}
                </span>
                {s.status === "booked" ? (
                  <button
                    type="button"
                    aria-label={tx("Cancel session")}
                    disabled={busy}
                    onClick={() => void cancelBooked(s)}
                    className="grid size-7 place-items-center rounded-full border border-white/10"
                  >
                    <CalendarX className="size-3" />
                  </button>
                ) : (
                  s.source !== "google" && (
                    <button
                      type="button"
                      aria-label={tx("Remove time")}
                      disabled={busy}
                      onClick={() => void removeSlot(s)}
                      className="grid size-7 place-items-center rounded-full border border-white/10"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )
                )}
              </span>
              </div>
              {b && (
                <p className="mt-1 text-[11px] opacity-90">
                  {b.project_id ? (
                    <RouterLink
                      to="/artists/requests/$id"
                      params={{ id: b.project_id }}
                      className="underline underline-offset-2"
                    >
                      {b.client}
                      {b.title ? ` · ${b.title}` : ""}
                    </RouterLink>
                  ) : (
                    <span>{b.client}</span>
                  )}
                  <span className="ml-1 whitespace-pre opacity-70">{" "}
                    {tx("· Session")}{" "}{b.session_number}
                    {b.total ? ` of ${b.total}` : ""}
                  </span>
                </p>
              )}
            </li>
            );
          })}
        </ul>


        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            aria-label={tx("New time")}
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="h-11 min-w-0 rounded-md border border-border bg-secondary px-2 text-sm"
          />
          <select
            aria-label={tx("Length")}
            value={newLength}
            onChange={(e) => setNewLength(Number(e.target.value))}
            className="h-11 min-w-0 rounded-md border border-border bg-secondary px-2 text-sm"
          >
            {[30, 60, 90, 120, 180, 240].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <Button type="button" disabled={busy} onClick={() => void addSlot()}>
            <Plus className="size-4" />{" "}{tx("Add")}
          </Button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void blockDay()}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest"
          >
            <Ban className="size-3" />{" "}{tx("Block day")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void unblockDay()}
            className="flex h-10 flex-1 items-center justify-center rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest"
          >
            {tx("Re-open day")}
          </button>
        </div>
      </div>
    </section>
  );
}
