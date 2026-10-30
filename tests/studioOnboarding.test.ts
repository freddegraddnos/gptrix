import { describe, expect, it } from "vitest";
import { onboardingStatus } from "@/lib/studioOnboarding";

const base = {
  studio_name: "Ink", address: "Gatan 1", contact_email: "a@b.se", styles: ["Realism"],
  notify_email_enabled: true, onboarding_details_saved_at: "2026-10-13",
};

describe("onboardingStatus", () => {
  it("saved but untested is not ready", () => {
    const s = onboardingStatus(base);
    expect(s.detailsSaved).toBe(true);
    expect(s.notificationTested).toBe(false);
    expect(s.readyForRequests).toBe(false);
  });
  it("tested but details not saved is not ready", () => {
    const s = onboardingStatus({ ...base, onboarding_details_saved_at: null, notify_test_email_at: "x" });
    expect(s.notificationTested).toBe(true);
    expect(s.readyForRequests).toBe(false);
  });
  it("saved and tested on an enabled channel is ready", () => {
    expect(onboardingStatus({ ...base, notify_test_email_at: "x" }).readyForRequests).toBe(true);
  });
  it("an SMS test does not count when SMS is turned off", () => {
    expect(onboardingStatus({ ...base, notify_test_sms_at: "x" }).notificationTested).toBe(false);
  });
  it("no styles means work step remains", () => {
    expect(onboardingStatus({ ...base, styles: [] }).remaining).toContain("work");
  });
});
