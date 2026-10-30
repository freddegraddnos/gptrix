import { test } from "node:test";
import assert from "node:assert/strict";
import { requestOpenSlot, requestReplacement } from "../src/lib/slotRequests";

test("a lost slot race refreshes availability and cannot report success", async () => {
  let refreshed = 0;
  await assert.rejects(
    requestOpenSlot(
      async () => ({ data: [], error: null }),
      async () => {
        refreshed++;
      },
    ),
    /no longer available/,
  );
  assert.equal(refreshed, 1);
});

test("a failed replacement claim keeps the previous appointment", async () => {
  let cancelled = false;
  await assert.rejects(
    requestReplacement(
      async () => {
        throw new Error("lost race");
      },
      async () => {
        cancelled = true;
      },
    ),
    /lost race/,
  );
  assert.equal(cancelled, false);
});

test("a successful claim with failed release reports the partial outcome", async () => {
  const calls: string[] = [];
  const result = await requestReplacement(
    async () => {
      calls.push("claim");
    },
    async () => {
      calls.push("release");
      throw new Error("offline");
    },
  );
  assert.deepEqual(calls, ["claim", "release"]);
  assert.equal(result.previousReleased, false);
});
