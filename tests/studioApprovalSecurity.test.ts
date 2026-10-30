import { describe, it, expect } from "vitest";
import {
  studioApprovalTokenDigest,
  studioApprovalTokenMatches,
} from "../src/lib/studioApprovalToken";
import { requireStudioPlatformAdmin } from "../src/lib/studioPlatformAdmin";

describe("publication approval boundaries", () => {
  const bearer = "a".repeat(64);
  it("accepts the real link but not its owner-readable digest", async () => {
    const stored = await studioApprovalTokenDigest(bearer);
    expect(await studioApprovalTokenMatches(bearer, stored)).toBe(true);
    expect(await studioApprovalTokenMatches(stored, stored)).toBe(false);
    expect(await studioApprovalTokenMatches("b".repeat(64), stored)).toBe(false);
  });
  it("preserves pre-existing link tokens", async () => {
    expect(await studioApprovalTokenMatches(bearer, bearer)).toBe(true);
  });
  it("allows only an affirmative real platform admin role", async () => {
    for (const result of [
      { data: false, error: null },
      { data: null, error: null },
      { data: true, error: new Error("offline") },
    ]) {
      await expect(
        requireStudioPlatformAdmin({ rpc: async () => result }, "owner"),
      ).rejects.toThrow("administrator");
    }
    await expect(
      requireStudioPlatformAdmin(
        {
          rpc: async (name, args) => {
            expect(name).toBe("has_role");
            expect(args).toEqual({ _user_id: "admin", _role: "admin" });
            return { data: true, error: null };
          },
        },
        "admin",
      ),
    ).resolves.toBeUndefined();
  });
});
