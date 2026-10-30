import { useState } from "react";
import { useArtistBookings, type Booking } from "@/hooks/useBookings";
import { CalendarClock, ChevronRight, Loader2, Ruler } from "lucide-react";
import { BookingReviewDialog } from "@/components/BookingReviewDialog";

import { tx, useUiLang } from "@/lib/uiLang";
/** Booking requests sent to this studio; tap one to review, approve or decline. */
export function ArtistBookings({ artistId }: { artistId: string }) {
  useUiLang();
  const { bookings, loading, refresh } = useArtistBookings(artistId);
  const [open, setOpen] = useState<Booking | null>(null);

  if (loading && bookings.length === 0) {
    return (
      <div className="py-10 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-accent" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tx("No booking requests yet. Clients can book you from the studio map and the artist search.")}
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {bookings.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => setOpen(b)}
              className="w-full rounded-2xl border border-border bg-slate p-4 text-left transition hover:border-accent"
            >
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-accent" />
                <span className="font-semibold">
                  {b.preferred_date}
                  {b.preferred_time ? ` · ${b.preferred_time}` : ""}
                </span>
                <span
                  className={`ml-auto text-[10px] uppercase tracking-widest ${
                    b.status === "confirmed"
                      ? "text-accent"
                      : b.status === "cancelled"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {b.status}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {b.body_area && <span>{b.body_area}</span>}
                {b.size_cm != null && (
                  <span className="flex items-center gap-1">
                    <Ruler className="size-3" />
                    {b.size_cm} cm
                  </span>
                )}
                {b.duration_minutes != null && <span>{b.duration_minutes} min</span>}
              </div>
              {b.note && <p className="mt-2 line-clamp-2 text-sm">{b.note}</p>}
            </button>
          </li>
        ))}
      </ul>
      <BookingReviewDialog booking={open} onClose={() => setOpen(null)} onDone={() => void refresh()} />
    </>
  );
}
