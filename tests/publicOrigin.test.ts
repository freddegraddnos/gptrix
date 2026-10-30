import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SITE_ORIGIN,
  parsePublicOrigin,
  publicSiteUrl,
  resolvePublicOrigin,
} from "../src/lib/publicOrigin";
import { robotsText } from "../src/lib/robots";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("deployment public origin", () => {
  it("preserves the existing production default", () => {
    expect(resolvePublicOrigin()).toBe(DEFAULT_SITE_ORIGIN);
    expect(resolvePublicOrigin("", "")).toBe("https://www.inksimulator.com");
  });
  it("normalizes an HTTPS origin and supports explicit runtime/build configuration", () => {
    expect(parsePublicOrigin("https://TRY.TATTOO:443/")).toBe("https://try.tattoo");
    expect(resolvePublicOrigin(undefined, "https://try.tattoo")).toBe("https://try.tattoo");
    expect(resolvePublicOrigin("https://try.tattoo", "https://www.inksimulator.com")).toBe(
      "https://try.tattoo",
    );
  });
  it("rejects unsafe or non-origin values instead of silently emitting old-host links", () => {
    for (const value of [
      "http://try.tattoo",
      "javascript:alert(1)",
      "//try.tattoo",
      "https://name:pass@try.tattoo",
      "https://try.tattoo/path",
      "https://try.tattoo/?key=x",
      "https://try.tattoo/#fragment",
      "not a URL",
    ]) {
      expect(parsePublicOrigin(value)).toBeUndefined();
      expect(() => resolvePublicOrigin(value)).toThrow("HTTPS origin");
      expect(() => resolvePublicOrigin(undefined, value)).toThrow("HTTPS origin");
    }
  });
  it("uses the configured host for operational links without accepting external targets", () => {
    vi.stubEnv("SITE_URL", "https://try.tattoo");
    expect(publicSiteUrl("/artists/requests/opaque-id?tab=sessions")).toBe(
      "https://try.tattoo/artists/requests/opaque-id?tab=sessions",
    );
    for (const value of ["//evil.example", "https://evil.example", "/\\evil.example", "/bad\npath"])
      expect(() => publicSiteUrl(value)).toThrow();
  });
  it("renders consistent canonical, OpenGraph, Twitter and breadcrumb URLs", async () => {
    vi.stubEnv("SITE_URL", "https://try.tattoo");
    const { seo } = await import("../src/lib/seo");
    const head = seo({
      path: "/studios",
      title: "Studios",
      description: "Real artists",
      breadcrumb: "Studios",
    });
    expect(head.links[0]).toEqual({ rel: "canonical", href: "https://try.tattoo/studios" });
    expect(head.meta).toContainEqual({ property: "og:url", content: "https://try.tattoo/studios" });
    expect(head.meta).toContainEqual({ name: "twitter:domain", content: "try.tattoo" });
    expect(JSON.parse(head.scripts[0]!.children).itemListElement[1].item).toBe(
      "https://try.tattoo/studios",
    );
  });
  it("retains crawler policy while moving the advertised sitemap to the configured host", () => {
    vi.stubEnv("SITE_URL", "https://try.tattoo");
    const text = robotsText();
    expect(text).toContain("User-agent: *\nAllow: /");
    expect(text).toContain("User-agent: GPTBot\nAllow: /");
    expect(text).toContain("Sitemap: https://try.tattoo/sitemap.xml\n");
    expect(text).not.toContain("www.inksimulator.com");
  });
});
