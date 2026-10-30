import { describe, expect, it } from "vitest";
import { bookingLinkState, formatDuration, sessionPlanSummary } from "@/lib/sessionPlan";

describe("session plan", () => {
  it("3 × 2 hours is 6 hours", () => {
    expect(sessionPlanSummary(3, 120)).toEqual({ total: 360, text: "3 × 2 h = 6 h" });
  });
  it("shows hours and minutes", () => {
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
  });
  it("an unchanged plan is not sent twice", () => {
    expect(bookingLinkState({ sentAt: "2026-10-01", count: 3, minutes: 120 }, 3, 120)).toBe("already_sent_same");
  });
  it("a changed plan may be sent again", () => {
    expect(bookingLinkState({ sentAt: "2026-10-01", count: 3, minutes: 120 }, 2, 120)).toBe("sent_with_other_plan");
    expect(bookingLinkState({ sentAt: null, count: null, minutes: null }, 2, 120)).toBe("never_sent");
  });
});
