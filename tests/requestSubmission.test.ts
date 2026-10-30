import { describe, expect, it } from "vitest";
import { insertRequestOnce, validRequestFiles } from "../src/lib/requestSubmission";
import { validMotifContext, motifRequestPath } from "../src/lib/motifRequestContext";

describe("request submission", () => {
  const row = { id: "key", client_user_id: "customer", artist_id: "studio" };
  it("returns the original request on retry without inserting or notifying twice", async () => {
    let inserted = false;
    const result = await insertRequestOnce(
      "key",
      "customer",
      "studio",
      async () => row,
      async () => {
        inserted = true;
        return { row, error: null };
      },
    );
    expect(result.created).toBe(false);
    expect(inserted).toBe(false);
  });
  it("handles two racing sends with only one creator", async () => {
    let stored: typeof row | null = null;
    const insert = async () => {
      if (stored) return { row: null, error: { code: "23505" } };
      stored = row;
      return { row, error: null };
    };
    const results = await Promise.all(
      [0, 1].map(() => insertRequestOnce("key", "customer", "studio", async () => stored, insert)),
    );
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results.map((r) => r.row.id)).toEqual(["key", "key"]);
  });
  it("cannot reuse another customer's or studio's request key", async () => {
    await expect(
      insertRequestOnce(
        "key",
        "intruder",
        "studio",
        async () => row,
        async () => ({ row, error: null }),
      ),
    ).rejects.toThrow("different request");
    await expect(
      insertRequestOnce(
        "key",
        "customer",
        "other",
        async () => row,
        async () => ({ row, error: null }),
      ),
    ).rejects.toThrow("different request");
  });
  it("rejects invalid files before a request can be created", () => {
    expect(
      validRequestFiles([
        { size: 100, type: "image/png" },
        { size: 100, type: "application/pdf" },
      ]),
    ).toBe(true);
    expect(validRequestFiles([{ size: 16 * 1024 * 1024, type: "image/png" }])).toBe(false);
    expect(validRequestFiles([{ size: 100, type: "text/html" }])).toBe(false);
  });
});
describe("motif recipient context", () => {
  it("accepts UUID provenance and rejects injected or malformed handles", () => {
    const context = {
      motifId: "11111111-1111-1111-1111-111111111111",
      studioId: "22222222-2222-2222-2222-222222222222",
      handle: "real-studio",
    };
    expect(validMotifContext(context)).toBe(true);
    expect(motifRequestPath(context)).toContain("/real-studio/book?motif=");
    expect(validMotifContext({ ...context, handle: "//evil.test" })).toBe(false);
  });
});
