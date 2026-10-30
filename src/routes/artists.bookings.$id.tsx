import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { BookingReviewDialog } from "@/components/BookingReviewDialog";
import { StudioShell } from "@/components/StudioShell";
import { Button } from "@/components/ui/button";
import { getStudioBooking } from "@/lib/bookingReview.functions";
import type { Booking } from "@/hooks/useBookings";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/bookings/$id")({
  head: () => ({ meta: [{ title: tx("Booking request — InkSimulator Studio") }, { name: "description", content: "Review a private studio booking request." }, { property: "og:title", content: "Studio booking — InkSimulator" }, { property: "og:description", content: "Private studio booking details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <RequireAuth requireVerified title={tx("Sign in to review your booking")}><BookingDetail /></RequireAuth>,
});

function BookingDetail() {
  useUiLang();
  const { id } = Route.useParams();
  const get = useServerFn(getStudioBooking);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  useEffect(() => {
    let active = true;
    void get({ data: { bookingId: id } }).then(row => { if (active) setBooking(row as Booking); }).catch(() => { if (active) setError(tx("Booking not found or unavailable for this account.")); });
    return () => { active = false; };
  }, [id, get]);
  return <StudioShell current="bokningar" detail narrow title={tx("Booking request")}>
    {error ? <p role="alert" className="mt-5 text-sm text-destructive">{error}</p> : !booking ? <Loader2 className="mt-6 size-5 animate-spin text-accent" /> : <div className="space-y-5 border-t border-border pt-5 text-sm">
      <p className="font-bold">{booking.studio_name} · {booking.preferred_date}{booking.preferred_time ? ` at ${booking.preferred_time}` : ""}</p>
      <dl className="grid grid-cols-2 gap-3"><div><dt className="text-muted-foreground">{tx("Placement")}</dt><dd>{booking.body_area || tx("Not specified")}</dd></div><div><dt className="text-muted-foreground">{tx("Size")}</dt><dd>{booking.size_cm != null ? `${booking.size_cm} cm` : tx("Not specified")}</dd></div><div><dt className="text-muted-foreground">{tx("Booked length")}</dt><dd>{booking.duration_minutes != null ? `${booking.duration_minutes} min` : tx("Not specified")}</dd></div><div><dt className="text-muted-foreground">{tx("Status")}</dt><dd>{booking.status}</dd></div></dl>
      {booking.note && <p className="whitespace-pre-wrap">{booking.note}</p>}
      <Button type="button" onClick={() => setOpen(true)} variant="outline">{tx("View design, images & decision")}</Button>
      <BookingReviewDialog booking={open ? booking : null} onClose={() => setOpen(false)} onDone={() => void get({ data: { bookingId: id } }).then(row => setBooking(row as Booking))} />
    </div>}
  </StudioShell>;
}