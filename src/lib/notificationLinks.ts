import type { Notification } from "@/hooks/useNotifications";

/** Where a notification should take you when tapped. */
export function pathFor(n: Notification): string {
  if (n.link) return n.link;
  // Older booking notices without a link: studios land in their bookings list.
  if (n.kind === "booking" && typeof window !== "undefined" && sessionStorage.getItem("inksimulator.studio-notifications") === "1")
    return "/artists/dashboard?tab=bokningar";
  if (n.kind === "message" && n.conversation_id) return `/messages/${n.conversation_id}`;
  if (n.kind === "booking") return "/bookings/activity";
  return "/community";
}

export type NotificationFilter = "all" | "booking" | "scan" | "message" | "community";

/** Scan updates ride on the booking kind, so match on the copy. */
export function isScanNotification(n: Notification) {
  return n.kind === "booking" && /3d|scan/i.test(n.body ?? "");
}

export function matchesFilter(n: Notification, filter: NotificationFilter) {
  switch (filter) {
    case "all":
      return true;
    case "scan":
      return isScanNotification(n);
    case "booking":
      return n.kind === "booking" && !isScanNotification(n);
    case "message":
      return n.kind === "message";
    case "community":
      return n.kind === "like" || n.kind === "comment" || n.kind === "follow";
  }
}
