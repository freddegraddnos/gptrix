import { getPublicOrigin } from "@/lib/publicOrigin";
export const LIVE_SITE_ORIGIN = getPublicOrigin();

export function studioBookingPath(handle: string) {
  return `/${encodeURIComponent(handle)}/book`;
}

export function studioBookingUrl(handle: string) {
  return `${LIVE_SITE_ORIGIN}${studioBookingPath(handle)}`;
}