import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  DEFAULT_STUDIO_MODULES,
  normalizeStudioModules,
  studioNavVisible,
} from "../src/lib/studioModules";

describe("studio module choices", () => {
  it("keeps existing tools visible until a studio chooses", () => {
    assert.deepEqual(normalizeStudioModules(null), DEFAULT_STUDIO_MODULES);
    assert.equal(studioNavVisible("kalender", normalizeStudioModules(null)), true);
  });
  it("filters optional navigation while leaving existing cases and settings accessible", () => {
    const selected = normalizeStudioModules(["designs", "unknown"]);
    assert.deepEqual(selected, ["designs"]);
    assert.equal(studioNavVisible("motiv", selected), true);
    assert.equal(studioNavVisible("kalender", selected), false);
    assert.equal(studioNavVisible("bokningar", selected), true);
    assert.equal(studioNavVisible("prefs", selected), true);
  });
  it("retains an intentional empty selection", () => {
    assert.deepEqual(normalizeStudioModules([]), []);
  });
});
