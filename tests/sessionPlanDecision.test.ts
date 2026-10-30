import { describe, expect, it } from "vitest";
import { sendDecision, slotFits } from "@/lib/sessionPlan";

const base = { hasCustomer: true, matchingSlots: 2, allowWithoutTimes: false, linkState: "never_sent" as const, sendingSince: null, now: Date.parse("2026-10-13T10:00:00Z") };

describe("send decision before booking link", () => {
  it("zero free times blocks sending", () => {
    expect(sendDecision({ ...base, matchingSlots: 0 }).reason).toBe("no_times");
  });
  it("zero free times only allowed by explicit choice", () => {
    expect(sendDecision({ ...base, matchingSlots: 0, allowWithoutTimes: true }).ok).toBe(true);
  });
  it("valid times allow sending", () => {
    expect(sendDecision(base).ok).toBe(true);
  });
  it("no real customer blocks sending", () => {
    expect(sendDecision({ ...base, hasCustomer: false }).reason).toBe("no_customer");
  });
  it("a send in progress blocks a double click", () => {
    expect(sendDecision({ ...base, sendingSince: "2026-10-13T09:59:50Z" }).reason).toBe("in_progress");
  });
  it("an abandoned send older than a minute may be retried", () => {
    expect(sendDecision({ ...base, sendingSince: "2026-10-13T09:58:00Z" }).ok).toBe(true);
  });
  it("same plan already sent is not sent again", () => {
    expect(sendDecision({ ...base, linkState: "already_sent_same" }).reason).toBe("already_sent");
  });
});

describe("free time length", () => {
  it("a 60 min time cannot hold a 2 h session", () => {
    expect(slotFits(60, 120)).toBe(false);
  });
  it("a 120 or longer time holds a 2 h session", () => {
    expect(slotFits(120, 120)).toBe(true);
    expect(slotFits(180, 120)).toBe(true);
  });
});
