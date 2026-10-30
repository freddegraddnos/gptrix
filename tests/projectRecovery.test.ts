import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  upload: vi.fn(),
  sign: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mock.upload, createSignedUrl: mock.sign, remove: mock.remove }),
    },
    from: mock.from,
  },
}));

import { saveProject } from "../src/hooks/useProjects";

beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: mock.maybeSingle,
    single: mock.single,
    insert: mock.insert,
  };
  mock.from.mockReturnValue(query);
  mock.insert.mockReturnValue(query);
  mock.maybeSingle.mockResolvedValue({ data: null, error: null });
  mock.single.mockResolvedValue({
    data: { id: "project", preview_url: "signed", base_photo_url: "signed" },
    error: null,
  });
  mock.upload.mockResolvedValue({ error: null });
  mock.sign.mockResolvedValue({
    data: { signedUrl: "https://private.example.test/signed" },
    error: null,
  });
  mock.remove.mockResolvedValue({ error: null });
});

describe("project recovery and truthful save status", () => {
  it("does not insert a project if the preview upload failed", async () => {
    mock.upload.mockResolvedValue({ error: new Error("offline") });
    await expect(
      saveProject({ userId: "user", name: "Idea", previewDataUrl: "data:image/png;base64,AAAA" }),
    ).rejects.toThrow("offline");
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it("fails if an uploaded image cannot be signed", async () => {
    mock.sign.mockResolvedValue({ data: null, error: new Error("sign failed") });
    await expect(
      saveProject({ userId: "user", name: "Idea", previewDataUrl: "data:image/png;base64,AAAA" }),
    ).rejects.toThrow("sign failed");
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.remove).toHaveBeenCalledOnce();
  });
  it("does not lose the before-image or create a partial project on second upload failure", async () => {
    mock.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("quota") });
    await expect(
      saveProject({
        userId: "user",
        name: "Idea",
        previewDataUrl: "data:image/png;base64,AAAA",
        basePhotoDataUrl: "data:image/png;base64,AAAA",
      }),
    ).rejects.toThrow("quota");
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.remove).toHaveBeenCalledOnce();
  });
  it("reuses an already saved recovery project without uploading or overwriting", async () => {
    const saved = { id: "stable-project", name: "Original snapshot" };
    mock.maybeSingle.mockResolvedValue({ data: saved, error: null });
    expect(
      await saveProject({
        projectId: "stable-project",
        userId: "user",
        name: "Changed after save",
        previewDataUrl: "data:image/png;base64,AAAA",
      }),
    ).toEqual(saved);
    expect(mock.upload).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it("persists selected motif with the stable recovery ID and actual uploaded images", async () => {
    await saveProject({
      projectId: "stable-project",
      userId: "user",
      name: "Idea",
      tattooId: "motif",
      previewDataUrl: "data:image/png;base64,AAAA",
      basePhotoDataUrl: "data:image/png;base64,AAAA",
    });
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "stable-project",
        tattoo_id: "motif",
        preview_url: "https://private.example.test/signed",
        base_photo_url: "https://private.example.test/signed",
      }),
    );
  });
});
