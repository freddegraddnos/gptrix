/**
 * Pure rules for a studio's request list and case header. Every result is
 * derived from saved facts only — no invented deadlines or guesses.
 */
export type CaseFacts = {
  status: string;
  createdAt: string;
  studioReadAt: string | null;
  lastClientMessageAt: string | null;
  lastStudioMessageAt: string | null;
  moreTimesRequestedAt: string | null;
  moreTimesNotifiedAt: string | null;
  bookingLinkSentAt: string | null;
  latestSketch: { versionNumber: number; approvedAt: string | null } | null;
  booking: { status: string; date: string | null } | null;
  deposit: { status: string } | null;
};

export type CaseAction = { reason: string; next: string; tab: "conversation" | "sketches" | "sessions" };

const t = (v: string | null) => (v ? Date.parse(v) : 0);
const CLOSED = new Set(["archived", "completed"]);

/** The studio's turn, or null when the case waits on the customer or is closed. */
export function studioAction(f: CaseFacts): CaseAction | null {
  if (CLOSED.has(f.status)) return null;
  if (f.moreTimesRequestedAt && t(f.moreTimesNotifiedAt) < t(f.moreTimesRequestedAt))
    return { reason: "Customer needs more booking times", next: "Add times", tab: "sessions" };
  if (f.lastClientMessageAt && t(f.lastClientMessageAt) > t(f.lastStudioMessageAt))
    return { reason: "Customer message awaiting reply", next: "Reply in the conversation", tab: "conversation" };
  if (f.status === "changes_requested")
    return { reason: "Customer asked for changes", next: "Upload a new sketch version", tab: "sketches" };
  if (f.status === "open" && !f.latestSketch && !f.lastStudioMessageAt)
    return { reason: "New request", next: "Reply or start a sketch", tab: "conversation" };
  const approved = f.status === "approved" || !!f.latestSketch?.approvedAt;
  if (approved && !f.bookingLinkSentAt && !f.booking && f.status !== "booked")
    return { reason: "Design approved", next: "Plan sessions and send the booking link", tab: "sessions" };
  return null;
}

/** What the case is waiting for when it is not the studio's turn. */
export function waitingOn(f: CaseFacts): string | null {
  if (CLOSED.has(f.status)) return null;
  if (f.latestSketch && !f.latestSketch.approvedAt && f.status !== "approved") return "Waiting for the customer to review the sketch";
  if (f.bookingLinkSentAt && !f.booking) return "Waiting for the customer to book";
  if (f.deposit?.status === "unpaid") return "Waiting for the deposit";
  return null;
}

/** Unread = the customer did something after the studio last opened the case. */
export function isUnread(f: CaseFacts): boolean {
  if (!f.studioReadAt) return true;
  const read = t(f.studioReadAt);
  return t(f.lastClientMessageAt) > read || t(f.moreTimesRequestedAt) > read;
}

export function designStatus(f: CaseFacts): string {
  if (!f.latestSketch) return "No sketch yet";
  return f.latestSketch.approvedAt
    ? `Version ${f.latestSketch.versionNumber} approved`
    : `Version ${f.latestSketch.versionNumber} · awaiting approval`;
}
export function bookingStatus(f: CaseFacts): string {
  if (f.booking) return f.booking.status === "confirmed" ? "Booked" : "Booking requested";
  if (f.status === "booked") return "Booked";
  if (f.bookingLinkSentAt) return "Booking link sent";
  return "Not booked";
}
export function paymentStatus(f: CaseFacts): string {
  if (!f.deposit) return "No deposit requested";
  return f.deposit.status === "paid" ? "Deposit paid" : "Deposit unpaid";
}
