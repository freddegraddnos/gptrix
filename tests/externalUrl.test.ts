import { describe, expect, it } from "vitest";
import { isValidOptionalWebsite, normalizeExternalUrl } from "../src/lib/externalUrl";

describe("normalizeExternalUrl", () => {
  it("rejects the stored Beyond ink value instead of guessing a domain", () => {
    expect(normalizeExternalUrl("Beyond ink studio.com")).toBeNull();
  });
  it("adds https to a bare domain so it never renders as a relative link", () => {
    expect(normalizeExternalUrl("beyondink.se")).toBe("https://beyondink.se/");
    expect(normalizeExternalUrl("  www.example.com/booking ")).toBe("https://www.example.com/booking");
  });
  it("keeps explicit http and https addresses", () => {
    expect(normalizeExternalUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeExternalUrl("https://studio.example.co.uk/a?b=1")).toBe("https://studio.example.co.uk/a?b=1");
  });
  it("rejects unsafe or non-web schemes", () => {
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("mailto:a@b.se")).toBeNull();
    expect(normalizeExternalUrl("ftp://example.com")).toBeNull();
  });
  it("rejects values without a real domain", () => {
    expect(normalizeExternalUrl("beyondink")).toBeNull();
    expect(normalizeExternalUrl("localhost:3000")).toBeNull();
    expect(normalizeExternalUrl("/beyondinkstudio")).toBeNull();
    expect(normalizeExternalUrl("https://user:pw@example.com")).toBeNull();
    expect(normalizeExternalUrl("")).toBeNull();
    expect(normalizeExternalUrl(null)).toBeNull();
  });
  it("allows an empty optional field but not an invalid one", () => {
    expect(isValidOptionalWebsite("")).toBe(true);
    expect(isValidOptionalWebsite("Beyond ink studio.com")).toBe(false);
  });
});
