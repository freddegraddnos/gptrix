import { describe, expect, it } from "vitest";
import { studioInterestSchema } from "../src/lib/studioInterest.schema";

describe("studio interest validation", () => {
  it("accepts the four required studio contact fields", () => {
    const result = studioInterestSchema.safeParse({
      studioName: "Lilla Gatan Studio",
      contactName: "Ida Leino",
      email: "ida@example.com",
      phone: "+46701234567",
      website: "",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["studio name", { studioName: "", contactName: "Ida Leino", email: "ida@example.com", phone: "+46701234567", website: "" }],
    ["contact person", { studioName: "Lilla Gatan Studio", contactName: "", email: "ida@example.com", phone: "+46701234567", website: "" }],
    ["valid email", { studioName: "Lilla Gatan Studio", contactName: "Ida Leino", email: "not-an-email", phone: "+46701234567", website: "" }],
    ["phone number", { studioName: "Lilla Gatan Studio", contactName: "Ida Leino", email: "ida@example.com", phone: "12", website: "" }],
  ])("requires %s", (_label, input) => {
    expect(studioInterestSchema.safeParse(input).success).toBe(false);
  });

  it("rejects the hidden bot field when populated", () => {
    expect(studioInterestSchema.safeParse({
      studioName: "Lilla Gatan Studio",
      contactName: "Ida Leino",
      email: "ida@example.com",
      phone: "+46701234567",
      website: "spam.example",
    }).success).toBe(false);
  });
});