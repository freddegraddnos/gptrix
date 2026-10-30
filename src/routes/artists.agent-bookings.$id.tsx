import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { StudioShell } from "@/components/StudioShell";
import { Button } from "@/components/ui/button";
import { decideAgentBooking, getAgentBookingDetail } from "@/lib/agentSettings.functions";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/agent-bookings/$id")({
  head: () => ({ meta: [{ title: tx("Agent booking — InkSimulator Studio") }, { name: "description", content: "Review a private booking from your studio agent." }, { property: "og:title", content: "Agent booking — InkSimulator" }, { property: "og:description", content: "Private studio agent booking details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <RequireAuth requireVerified title={tx("Sign in to review your booking")}><AgentBookingDetail /></RequireAuth>,
});

function AgentBookingDetail() {
  useUiLang();
  const { id } = Route.useParams();
  const get = useServerFn(getAgentBookingDetail);
  const decide = useServerFn(decideAgentBooking);
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof getAgentBookingDetail>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void get({ data: { bookingId: id } }).then(row => { if (active) setBooking(row); }).catch(() => { if (active) setError(tx("Booking not found or unavailable for this account.")); });
    return () => { active = false; };
  }, [id, get]);
  const act = async (decision: "confirm" | "decline") => {
    setBusy(true);
    try { await decide({ data: { bookingId: id, decision } }); setBooking(await get({ data: { bookingId: id } })); toast.success(tx("Booking updated")); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not update booking"); }
    finally { setBusy(false); }
  };
  return <StudioShell current="bokningar" detail narrow title={tx("Booking agent request")}>
    {error ? <p role="alert" className="mt-5 text-sm text-destructive">{error}</p> : !booking ? <Loader2 className="mt-6 size-5 animate-spin text-accent" /> : <div className="space-y-5 border-t border-border pt-5 text-sm">
      <p className="text-lg font-bold">{booking.customer_name}</p>
      <dl className="grid grid-cols-2 gap-3"><div><dt className="text-muted-foreground">{tx("Time")}</dt><dd>{new Date(booking.starts_at).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}</dd></div><div><dt className="text-muted-foreground">{tx("Booked length")}</dt><dd>{booking.duration_minutes} min</dd></div><div><dt className="text-muted-foreground">{tx("Placement")}</dt><dd>{booking.placement || tx("Not specified")}</dd></div><div><dt className="text-muted-foreground">{tx("Size")}</dt><dd>{booking.size_cm != null ? `${booking.size_cm} cm` : tx("Not specified")}</dd></div><div><dt className="text-muted-foreground">{tx("Status")}</dt><dd>{booking.status}</dd></div></dl>
      {booking.idea && <section><h2 className="font-display text-xl uppercase">{tx("Design brief")}</h2><p className="mt-1 whitespace-pre-wrap">{booking.idea}</p></section>}
      {booking.motif_url && <a href={booking.motif_url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{tx("View motif")}</a>}
      <div className="space-y-1">{booking.customer_email && <a href={`mailto:${booking.customer_email}`} className="block text-accent underline">{booking.customer_email}</a>}{booking.customer_phone && <a href={`tel:${booking.customer_phone}`} className="block text-accent underline">{booking.customer_phone}</a>}</div>
      {booking.status === "pending" && <div className="flex gap-2"><Button disabled={busy} onClick={() => void act("confirm")}>{tx("Approve")}</Button><Button variant="outline" disabled={busy} onClick={() => void act("decline")}>{tx("Decline")}</Button></div>}
    </div>}
  </StudioShell>;
}