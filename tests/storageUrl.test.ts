import { describe, expect, it } from "vitest";
import { storagePathFromSignedUrl } from "@/lib/storageUrl";

describe("reference image links", () => {
  it("an expired signed link still points to the stored file", () => {
    expect(storagePathFromSignedUrl("https://x.supabase.co/storage/v1/object/sign/project-previews/u1/a%20b.png?token=old"))
      .toEqual({ bucket: "project-previews", path: "u1/a b.png" });
  });
  it("an outside link is left alone", () => {
    expect(storagePathFromSignedUrl("https://example.com/a.png")).toBeNull();
  });
});
