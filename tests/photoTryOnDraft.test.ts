import { describe, expect, it } from "vitest";
import { parsePhotoTryOnDraft, PHOTO_DRAFT_MAX_AGE } from "../src/lib/photoTryOnDraft";

const draft = {
  version: 1,
  photoDataUrl: "data:image/png;base64,AAAA",
  motifId: "rose",
  pose: { x: 0.2, y: 0.6, scale: 1.2, rotation: 1.1, bend: 130 },
  updatedAt: 1000,
};

describe("private photo draft recovery", () => {
  it("retains original photo, editable pose and motif rather than a flattened picture", () => {
    expect(parsePhotoTryOnDraft(draft, 2000)).toEqual(draft);
  });
  it("rejects stale and future records", () => {
    expect(parsePhotoTryOnDraft(draft, 1001 + PHOTO_DRAFT_MAX_AGE)).toBeNull();
    expect(parsePhotoTryOnDraft(draft, 999)).toBeNull();
  });
  it("rejects invalid images, versions and non-finite rendering values", () => {
    expect(
      parsePhotoTryOnDraft({ ...draft, photoDataUrl: "https://example.test/private.jpg" }, 2000),
    ).toBeNull();
    expect(parsePhotoTryOnDraft({ ...draft, version: 2 }, 2000)).toBeNull();
    expect(
      parsePhotoTryOnDraft({ ...draft, pose: { ...draft.pose, rotation: NaN } }, 2000),
    ).toBeNull();
    expect(parsePhotoTryOnDraft({ ...draft, pose: { ...draft.pose, scale: 0 } }, 2000)).toBeNull();
  });
});
