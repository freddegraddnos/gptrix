import { describe, expect, it } from "vitest";
import { planMinutes, planSummary, sessionMinutesAt, unfitSessions } from "@/lib/sessionPlan";

describe("different length per session", () => {
  it("3 h then 2 h is 5 h", () => {
    expect(planSummary([180, 120])).toEqual({ total: 300, text: "3 h + 2 h = 5 h" });
  });
  it("without a saved plan all sessions share the length", () => {
    expect(planMinutes(2, 120, null)).toEqual([120, 120]);
  });
  it("session 1 is 3 h and session 2 is 2 h", () => {
    expect(sessionMinutesAt(0, 2, 120, [180, 120])).toBe(180);
    expect(sessionMinutesAt(1, 2, 120, [180, 120])).toBe(120);
  });
  it("only 2 h times leave the 3 h session without a time", () => {
    expect(unfitSessions([180, 120], [120, 120])).toEqual([0]);
  });
  it("one 3 h and one 2 h time hold both sessions", () => {
    expect(unfitSessions([180, 120], [120, 180])).toEqual([]);
  });
  it("one 3 h time cannot hold two sessions", () => {
    expect(unfitSessions([180, 120], [180])).toEqual([1]);
  });
});
