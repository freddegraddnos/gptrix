import { afterEach, describe, expect, it, vi } from "vitest";
import {
  safeRedirect,
  setPendingRedirect,
  peekPendingRedirect,
  takePendingRedirect,
} from "../src/lib/authRedirect";

afterEach(() => vi.unstubAllGlobals());

describe("authentication return destinations", () => {
  it("preserves the studio, motif query and fragment", () => {
    expect(safeRedirect("/my-studio/book?motif=123&idea=456#review")).toBe(
      "/my-studio/book?motif=123&idea=456#review",
    );
  });
  it.each([
    "//evil.test",
    "/\\evil.test",
    "/%5cevil.test",
    "/%2fevil.test",
    "/%0devil.test",
    "https://evil.test",
    "/auth",
    "/auth#end",
    "/%61uth",
    "/foo/../auth?redirect=/profile",
    "/\nevil.test",
  ])("rejects unsafe or looping destination %s", (path) => {
    expect(safeRedirect(path)).toBeUndefined();
  });
  it("accepts only same-origin absolute URLs in a browser", () => {
    vi.stubGlobal("window", { location: { origin: "https://www.inksimulator.com" } });
    expect(safeRedirect("https://www.inksimulator.com/photo-tryon?motif=rose")).toBe(
      "/photo-tryon?motif=rose",
    );
    expect(safeRedirect("https://evil.test/photo-tryon")).toBeUndefined();
  });
  it("remembers then consumes the return path", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      setItem: (k: string, v: string) => data.set(k, v),
      getItem: (k: string) => data.get(k),
      removeItem: (k: string) => data.delete(k),
    });
    setPendingRedirect("/photo-tryon?motif=rose");
    setPendingRedirect(undefined);
    expect(peekPendingRedirect()).toBe("/photo-tryon?motif=rose");
    expect(takePendingRedirect()).toBe("/photo-tryon?motif=rose");
    expect(peekPendingRedirect()).toBeUndefined();
  });
  it("does not break login when browser storage is blocked", () => {
    const fail = () => {
      throw new Error("Storage blocked");
    };
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { setItem: fail, getItem: fail, removeItem: fail });
    expect(() => setPendingRedirect("/photo-tryon")).not.toThrow();
    expect(takePendingRedirect()).toBeUndefined();
  });
});
