import { describe, expect, it } from "vitest";
import { calculateStudioTimeValue, DEFAULT_STUDIO_TIME, parseStudioTimeNumber, restoreStudioTimeScenario, STUDIO_WORK_WEEKS } from "../src/lib/studioTimeValue";

describe("studio time value", () => {
  it("defaults to 15 minutes, 5 clients, 800 SEK and 48 weeks, rounding to 48000 SEK per year", () => {
    expect(DEFAULT_STUDIO_TIME.minutes).toBe("15");
    expect(DEFAULT_STUDIO_TIME.clients).toBe("5");
    expect(DEFAULT_STUDIO_TIME.rate).toBe("800");
    expect(STUDIO_WORK_WEEKS).toBe(48);
    const result = calculateStudioTimeValue(DEFAULT_STUDIO_TIME);
    expect(result.base).toBe(5 * 15 * 48 / 60);
    expect(Math.round(result.value)).toBe(48000);
    expect(result.value).toBe(result.hours * 800);
  });
  it("matches the reference example: 15 min, 5 clients/week, 48 weeks, 1000 SEK/hour = 60 hours and 60000 SEK per year", () => {
    const result = calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, rate: "1000" });
    expect(result.hours).toBe(60);
    expect(result.value).toBe(60000);
  });
  it("starts every extra service unchecked with zero minutes", () => {
    expect([DEFAULT_STUDIO_TIME.stencil, DEFAULT_STUDIO_TIME.fortnox, DEFAULT_STUDIO_TIME.leads]).toEqual([false, false, false]);
    expect([DEFAULT_STUDIO_TIME.stencilMinutes, DEFAULT_STUDIO_TIME.fortnoxMinutes, DEFAULT_STUDIO_TIME.leadsMinutes]).toEqual(["0", "0", "0"]);
  });
  it("does not add optional time to the base estimate unless the studio enables it", () => {
    const result = calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, stencilMinutes: "20", fortnoxMinutes: "60", leadsMinutes: "60" });
    expect(result.hours).toBe(60);
    expect(result.value).toBe(48000);
    expect([result.stencil, result.fortnox, result.leads]).toEqual([0, 0, 0]);
  });
  it("adds stencil minutes per client only when checked", () => {
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, stencil: true, stencilMinutes: "10" }).stencil).toBe(5 * 10 * 48 / 60);
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, stencilMinutes: "10" }).stencil).toBe(0);
  });
  it("adds Fortnox minutes per month only when checked", () => {
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, fortnox: true, fortnoxMinutes: "90" }).fortnox).toBe(18);
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, fortnoxMinutes: "90" }).fortnox).toBe(0);
  });
  it("adds leads own-work minutes per month only when checked", () => {
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, leads: true, leadsMinutes: "120" }).leads).toBe(24);
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, leadsMinutes: "120" }).leads).toBe(0);
  });
  it("sums full-precision hours before multiplying by the hourly rate", () => {
    const result = calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, stencil: true, stencilMinutes: "1", fortnox: true, fortnoxMinutes: "1", leads: true, leadsMinutes: "1" });
    expect(result.value).toBe((5 * 15 * 48 / 60 + 5 * 1 * 48 / 60 + 12 / 60 + 12 / 60) * 800);
  });
  it("accepts zero figures and both decimal separators", () => {
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, minutes: "0", clients: "0", rate: "0" }).value).toBe(0);
    expect(parseStudioTimeNumber("7,5")).toBe(7.5);
    expect(parseStudioTimeNumber("7.5")).toBe(7.5);
  });
  it("rejects empty, negative, nonnumeric and infinite active values", () => {
    for (const minutes of ["", "-1", "abc", "Infinity", "1e999"]) {
      expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, minutes }).valid).toBe(false);
    }
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, stencil: true, stencilMinutes: "" }).errors).toContain("stencilMinutes");
    expect(calculateStudioTimeValue({ ...DEFAULT_STUDIO_TIME, stencil: false, stencilMinutes: "" }).valid).toBe(true);
  });
  it("restores all figures and selections from the stored session", () => {
    const scenario = { ...DEFAULT_STUDIO_TIME, minutes: "35", clients: "8", rate: "950", stencil: true, stencilMinutes: "7", fortnox: true, fortnoxMinutes: "60", leads: true, leadsMinutes: "30" };
    expect(restoreStudioTimeScenario(JSON.stringify(scenario))).toEqual(scenario);
    expect(restoreStudioTimeScenario("broken")).toEqual(DEFAULT_STUDIO_TIME);
  });
});