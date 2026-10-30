import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { changePackage, initialBuilderContent, moveBlock, remainingTasks } from "./studioBuilderPrototype";

describe("isolated studio page builder", () => {
  test("Portfolio, Studio and Personal keep all existing content", () => {
    const c = { ...initialBuilderContent, bio: "My existing presentation", pages: [{ id: "1", kind: "page" as const, title: "Care", text: "Keep this", url: "" }] };
    for (const p of ["portfolio", "studio", "personal"] as const) {
      assert.equal(changePackage(c, p).content, c);
      assert.equal(changePackage(c, p).content.pages[0]?.text, "Keep this");
    }
  });
  test("reordering retains all seven blocks without mutating the original", () => {
    const next = moveBlock(initialBuilderContent.blocks, "about", -1);
    assert.equal(next[0], "about");
    assert.equal(next.length, 7);
    assert.equal(new Set(next).size, 7);
    assert.equal(initialBuilderContent.blocks[0], "works");
  });
  test("a usable studio page does not require team, AI or Fortnox", () => {
    assert.deepEqual(remainingTasks(initialBuilderContent).necessary, []);
    assert.deepEqual(remainingTasks({ ...initialBuilderContent, name: "" }).necessary, ["Ange studions namn"]);
    assert.ok(remainingTasks(initialBuilderContent).recommended.includes("Skriv en kort presentation"));
  });
});