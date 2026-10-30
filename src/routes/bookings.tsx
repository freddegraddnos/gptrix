import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Calendar, MapPin, Clock, Ruler, Trash2, X as XIcon, Navigation, CalendarPlus, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { useBookings } from "@/hooks/useBookings";
import { downloadIcs, googleCalendarUrl, localDateTime, outlookCalendarUrl } from "@/lib/ics";
import type { CalendarEvent } from "@/lib/ics";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: tx("My bookings — InkSimulator") },
      { name: "description", content: "Your booking requests to tattoo studios, with date, motif and size." },
      { property: "og:title", content: "My bookings — InkSimulator" },
      { property: "og:description", content: "Keep track of your studio appointments and tattoo briefs." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <RequireAuth requireVerified title={tx("Sign in to see your bookings")} description={tx("Your booking requests and studio appointments live in your account.")}>
      <BookingsPage />
    </RequireAuth>
  ),
});

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Awaiting confirmation", className: "bg-amber-500/15 text-amber-300" },
  confirmed: { label: "Confirmed", className: "bg-emerald-500/15 text-emerald-300" },
  awaiting_deposit: { label: "Waiting for deposit", className: "bg-accent/15 text-accent" },
  cancelled: { label: "Cancelled", className: "bg-white/5 text-muted-foreground" },
};

function calendarEvent(b: {
  id: string;
  studio_name: string;
  studio_address: string | null;
  preferred_date: string;
  preferred_time: string | null;
  duration_minutes: number | null;
  body_area: string | null;
  size_cm: number | null;
  note: string | null;
}): CalendarEvent {
  const details = [
    b.body_area ? `Placement: ${b.body_area}` : null,
    b.size_cm ? `Size: ${b.size_cm} cm` : null,
    b.note ? `Note: ${b.note}` : null,
    "Booked with InkSimulator",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    id: b.id,
    title: `Tattoo appointment — ${b.studio_name}`,
    description: details,
    location: b.studio_address ?? b.studio_name,
    start: localDateTime(b.preferred_date, b.preferred_time),
    durationMinutes: b.duration_minutes ?? 60,
    url: "https://www.inksimulator.com/bookings",
  };
}

function BookingsPage() {
  useUiLang();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { bookings, loading: fetching, cancel, remove } = useBookings(user?.id);

  // Bookings only make sense once there is a studio to book — otherwise send
  // people to the studio map instead of an empty inbox.
  useEffect(() => {
    if (!loading && user && !fetching && bookings.length === 0) {
      navigate({ to: "/studios", replace: true });
    }
  }, [loading, user, fetching, bookings.length, navigate]);

  return (
    <AppShell>
      <header className="pt-3 pb-4">
        <div className="text-[10px] uppercase tracking-[0.35em] text-accent">{tx("Studio")}</div>
        <h1 className="text-3xl font-bold mt-1">{tx("My bookings")}</h1>
        <Link
          to="/bookings/activity"
          className="mt-2 inline-block text-[11px] font-bold uppercase tracking-widest text-accent"
        >
          {tx("See all booking updates")}
        </Link>
        <p className="text-sm text-muted-foreground mt-1">
          {tx("Booking requests to studios from your map.")}
        </p>
      </header>

      <div className="flex gap-2 mb-4">
        <Link
          to="/studios"
          className="flex-1 h-11 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <MapPin className="size-4" />{" "}{tx("Find a studio")}
        </Link>
      </div>

      <Link
        to="/requests"
        className="mb-4 flex h-11 items-center justify-center rounded-xl border border-white/10 text-xs font-bold uppercase tracking-widest"
      >
        {tx("View my tattoo requests")}
      </Link>

      {fetching && (
        <div className="text-xs text-muted-foreground">{tx("Loading…")}</div>
      )}

      {!fetching && bookings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate p-8 text-center">
          <Calendar className="size-8 mx-auto text-muted-foreground mb-3" />
          <div className="font-bold">{tx("No bookings yet")}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {tx("Open the map, choose a studio and send your first request. A time is confirmed once the studio accepts it.")}
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {bookings.map((b) => {
          const meta = STATUS_META[b.status] ?? STATUS_META.pending;
          return (
            <li
              key={b.id}
              className="rounded-2xl border border-white/10 bg-slate p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold truncate">{b.studio_name}</div>
                  {b.artist_project_id && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-accent">
                      {tx("Session")}{" "}{b.session_number ?? 1}
                    </div>
                  )}

                  {b.studio_address && (
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="size-3" /> {b.studio_address}
                    </div>
                  )}
                </div>
                <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full shrink-0 ${meta.className}`}>
                  {tx(meta.label)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="size-3 text-accent" />
                  <span className="text-foreground font-bold">{b.preferred_date}</span>
                </div>
                {b.preferred_time && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3 text-accent" />
                    <span className="text-foreground font-bold">at {b.preferred_time}</span>
                  </div>
                )}
                {b.body_area && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-accent">◈</span>
                    <span className="text-foreground">{b.body_area}</span>
                  </div>
                )}
                {b.size_cm && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Ruler className="size-3 text-accent" />
                    <span className="text-foreground">{b.size_cm} cm</span>
                  </div>
                )}
              </div>

              {b.note && (
                <p className="mt-3 text-xs text-muted-foreground bg-ink/60 rounded-lg p-2 border border-white/5">
                  {b.note}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={googleCalendarUrl(calendarEvent(b))}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 rounded-lg border border-accent/40 text-accent font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                >
                  <CalendarPlus className="size-3" />{" "}{tx("Google Calendar")}
                </a>
                <a
                  href={outlookCalendarUrl(calendarEvent(b))}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 rounded-lg border border-accent/40 text-accent font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                >
                  <CalendarPlus className="size-3" />{" "}{tx("Outlook")}
                </a>
                <a
                  href={outlookCalendarUrl(calendarEvent(b), "office")}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 rounded-lg border border-white/10 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                >
                  <CalendarPlus className="size-3" />{" "}{tx("Outlook (work)")}
                </a>
                <button
                  onClick={() => downloadIcs(calendarEvent(b))}
                  className="h-9 rounded-lg border border-white/10 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                >
                  <Download className="size-3" />{" "}{tx("Apple / phone")}
                </button>
              </div>


              <div className="mt-2 flex gap-2">
                {b.studio_lat != null && b.studio_lng != null && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${b.studio_lat},${b.studio_lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 h-9 rounded-lg border border-white/10 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <Navigation className="size-3" />{" "}{tx("Directions")}
                  </a>
                )}
                {b.status !== "cancelled" ? (
                  <button
                    onClick={() => cancel(b.id)}
                    className="flex-1 h-9 rounded-lg border border-white/10 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <XIcon className="size-3" />{" "}{tx("Cancel")}
                  </button>
                ) : (
                  <button
                    onClick={() => remove(b.id)}
                    className="flex-1 h-9 rounded-lg border border-white/10 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 text-red-300"
                  >
                    <Trash2 className="size-3" />{" "}{tx("Remove")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
