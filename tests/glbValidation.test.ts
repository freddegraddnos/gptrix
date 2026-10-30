import { describe, expect, it } from "vitest";
import { validateLocalGlb } from "../src/lib/glbValidation";
function glb(json: unknown): ArrayBuffer {
  let text = JSON.stringify(json);
  text += " ".repeat((4 - (text.length % 4)) % 4);
  const body = new TextEncoder().encode(text);
  const bytes = new ArrayBuffer(20 + body.byteLength);
  const view = new DataView(bytes);
  [0x46546c67, 2, bytes.byteLength, body.byteLength, 0x4e4f534a].forEach((v, i) =>
    view.setUint32(i * 4, v, true),
  );
  new Uint8Array(bytes, 20).set(body);
  return bytes;
}
describe("private local GLB preview", () => {
  it("accepts embedded GLB v2 models", () =>
    expect(() =>
      validateLocalGlb(
        glb({
          asset: { version: "2.0" },
          scenes: [{}],
          images: [{ uri: "data:image/png;base64,AAAA" }],
        }),
      ),
    ).not.toThrow());
  it("rejects renamed images and videos", () =>
    expect(() => validateLocalGlb(new ArrayBuffer(30))).toThrow("GLB 2.0"));
  it("rejects truncated content", () => {
    const b = glb({ scenes: [{}] });
    new DataView(b).setUint32(12, 999999, true);
    expect(() => validateLocalGlb(b)).toThrow("GLB 2.0");
  });
  it("rejects external textures without a network request", () =>
    expect(() =>
      validateLocalGlb(glb({ scenes: [{}], images: [{ uri: "https://example.com/private" }] })),
    ).toThrow("embedded"));
  it("rejects relative buffer resources too", () =>
    expect(() => validateLocalGlb(glb({ scenes: [{}], buffers: [{ uri: "body.bin" }] }))).toThrow(
      "embedded",
    ));
  it("rejects files without a displayable scene", () =>
    expect(() => validateLocalGlb(glb({ scenes: [] }))).toThrow("no scene"));
});
