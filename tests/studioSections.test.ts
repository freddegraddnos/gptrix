import { describe, expect, it } from "vitest";
import { resolveSections } from "@/lib/studioPageTheme";

describe("studio page sections", () => {
  it("follows the layout when nothing is saved", () => {
    expect(resolveSections({ layout: "gallery" }).map((s) => s.key)).toEqual(["gallery", "about", "cta", "services"]);
  });
  it("keeps a saved order and visibility", () => {
    const r = resolveSections({ sections: [{ key: "services" }, { key: "gallery", hidden: true }] });
    expect(r.map((s) => s.key)).toEqual(["services", "gallery", "about", "cta"]);
    expect(r[1].hidden).toBe(true);
  });
  it("never hides the booking block", () => {
    expect(resolveSections({ sections: [{ key: "cta", hidden: true }] }).find((s) => s.key === "cta")?.hidden).toBeUndefined();
  });
});
