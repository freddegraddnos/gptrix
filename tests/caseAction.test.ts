import { describe, expect, it } from "vitest";
import { studioAction, isUnread, waitingOn, designStatus, type CaseFacts } from "../src/lib/caseAction";

const base: CaseFacts = { status: "open", createdAt: "2026-10-01T10:00:00Z", studioReadAt: null, lastClientMessageAt: null, lastStudioMessageAt: null, moreTimesRequestedAt: null, moreTimesNotifiedAt: null, bookingLinkSentAt: null, latestSketch: null, booking: null, deposit: null };

describe("case action", () => {
  it("a new untouched request needs the studio", () => {
    expect(studioAction(base)?.reason).toBe("New request");
  });
  it("customer message after the studio's last reply needs a reply", () => {
    expect(studioAction({ ...base, status: "sketch_in_progress", lastStudioMessageAt: "2026-10-02T10:00:00Z", lastClientMessageAt: "2026-10-03T10:00:00Z" })?.tab).toBe("conversation");
  });
  it("studio replied last and sketch shared: waits on customer, no action", () => {
    const f = { ...base, status: "sketch_in_progress", lastStudioMessageAt: "2026-10-03T10:00:00Z", lastClientMessageAt: "2026-10-02T10:00:00Z", latestSketch: { versionNumber: 2, approvedAt: null } };
    expect(studioAction(f)).toBeNull();
    expect(waitingOn(f)).toBe("Waiting for the customer to review the sketch");
    expect(designStatus(f)).toBe("Version 2 · awaiting approval");
  });
  it("unread is separate from needs action", () => {
    const read = { ...base, studioReadAt: "2026-10-05T10:00:00Z" };
    expect(isUnread(read)).toBe(false);
    expect(studioAction(read)).not.toBeNull();
    expect(isUnread({ ...read, lastClientMessageAt: "2026-10-06T10:00:00Z" })).toBe(true);
  });
  it("archived cases never need action", () => {
    expect(studioAction({ ...base, status: "archived" })).toBeNull();
  });
});
