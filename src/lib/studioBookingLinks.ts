import { publicSiteUrl } from "@/lib/publicOrigin";
/** Only opaque booking IDs appear in notices. Detail routes require studio authentication. */
export function studioBookingPath(id: string, agent = false): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid booking ID");
  return `/artists/${agent ? "agent-bookings" : "bookings"}/${id}`;
}

export function studioBookingUrl(id: string, agent = false): string {
  return publicSiteUrl(`${studioBookingPath(id, agent)}`);
}