import { describe, expect, it } from "vitest";
import { searchStudioActions } from "@/lib/studioActions";

const keys = (q: string) => searchStudioActions(q).map(a => a.key);

describe("studio action search", () => {
  it("meddelanden finds inbox, SMS and email notifications", () => {
    expect(keys("meddelanden")).toEqual(expect.arrayContaining(["inbox", "sms", "email"]));
  });
  it("tolerates a typo", () => {
    expect(keys("avisring")).toEqual(expect.arrayContaining(["sms", "email"]));
  });
  it("works without å/ä/ö", () => {
    expect(keys("tillganglighet")).toContain("hours");
  });
  it("unrelated text gives no result", () => {
    expect(keys("zxqv")).toEqual([]);
  });
});
