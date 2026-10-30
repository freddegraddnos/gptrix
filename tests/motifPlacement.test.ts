import { describe, expect, it } from "vitest";
import { matchesPlacementFilter, validatePlacement } from "@/lib/motifPlacement";

describe("motif placement", () => {
  it("sleeve needs arm or leg", () => {
    expect(validatePlacement(["back"], "full_sleeve")).not.toBeNull();
    expect(validatePlacement(["arm"], "half_sleeve")).toBeNull();
  });
  it("no specific placement matches every placement filter", () => {
    expect(matchesPlacementFilter({ placements: [], coverage: "single" }, "neck", "All")).toBe(true);
  });
  it("filters by recommended placement", () => {
    expect(matchesPlacementFilter({ placements: ["forearm"] }, "neck", "All")).toBe(false);
    expect(matchesPlacementFilter({ placements: ["forearm"] }, "forearm", "All")).toBe(true);
  });
  it("coverage filter is separate", () => {
    expect(matchesPlacementFilter({ placements: ["arm"], coverage: "full_sleeve" }, "All", "single")).toBe(false);
  });
});
