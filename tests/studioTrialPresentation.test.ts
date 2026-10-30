import { describe, expect, it } from "vitest";
import { STUDIO_TRIAL_PRESENTATION } from "../src/lib/studioTrialPresentation";

describe("owner-approved studio trial terms", () => {
  it("covers the entire 2026 trial without a fixed studio fee", () => {
    expect(STUDIO_TRIAL_PRESENTATION.year).toBe(2026);
    expect(STUDIO_TRIAL_PRESENTATION.fixedStudioFeeSek).toBe(0);
  });
  it("has no commission during the 2026 trial", () => {
    expect(STUDIO_TRIAL_PRESENTATION.commissionPercent).toBe(0);
  });
});