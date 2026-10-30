import { describe, expect, it } from "vitest";
import { sizeFieldFromIdea, sharedItems, sizeAndPlacementValid, mapProjectRow, placementFromIdea } from "../src/lib/ideaContext";

describe("idea context", () => {
  it("keeps a calibrated size exactly and never defaults", () => {
    expect(sizeFieldFromIdea(12.4)).toBe("12.4");
    expect(sizeFieldFromIdea(null)).toBe("");
    expect(sizeFieldFromIdea(0)).toBe("");
  });
  it("maps dimension and source from the saved idea", () => {
    const idea = mapProjectRow({ id: "x", name: "Rose", width_cm: "9.5", size_dimension: "height", size_source: "ar_calibrated", body_part: "Forearm", placement_note: "inner" });
    expect(idea.widthCm).toBe(9.5);
    expect(idea.sizeDimension).toBe("height");
    expect(idea.sizeSource).toBe("ar_calibrated");
    expect(placementFromIdea(idea)).toBe("Forearm — inner");
  });
  it("summary states size, dimension and source that are sent", () => {
    const items = sharedItems({ motif: "Rose", sizeCm: "9.5", sizeDimension: "height", sizeSource: "ar_calibrated", sizeUnsure: false, placement: "Forearm", placementUnsure: false, referenceCount: 2, uploadCount: 1, hasIdeaPhoto: true, description: "fine line" });
    expect(items.find((i) => i.key === "size")?.value).toBe("9.5 cm (height) · Calibrated in AR");
    expect(items.find((i) => i.key === "refs")?.value).toBe("3");
  });
  it("allows unsure instead of size or placement", () => {
    expect(sizeAndPlacementValid({ sizeCm: "", sizeUnsure: true, placement: "", placementUnsure: true })).toBe(true);
    expect(sizeAndPlacementValid({ sizeCm: "", sizeUnsure: false, placement: "Arm", placementUnsure: false })).toBe(false);
  });
});
