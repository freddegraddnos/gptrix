/**
 * Shared head/SEO builder for every public route. Gives each page its own
 * title + description, absolute www canonical/og:url, and the default
 * 1200x630 share image (so hosting never injects an old screenshot).
 */
import { getPublicOrigin } from "./publicOrigin";
export const SITE_URL = getPublicOrigin();
export const OG_IMAGE = `${SITE_URL}/og-inksimulator-v4.png?v=4`;
export const OG_IMAGE_ALT =
  "InkSimulator logo next to a phone showing a tattoo placed on a forearm in live AR";
/** Consistent brand signature: the name always paired with what the site does. */
export const BRAND_SV = "InkSimulator – prova tatuering i AR";
export const BRAND_EN = "InkSimulator – AR tattoo try-on";

type SeoInput = {
  path: string; // "/" or "/pricing"
  title: string;
  description: string;
  /** Breadcrumb label for inner pages (Home › label). Omit on the homepage. */
  breadcrumb?: string;
  image?: string;
  imageAlt?: string;
  lang?: "sv" | "en";
  extraLinks?: Array<Record<string, string>>;
  jsonLd?: Array<Record<string, unknown>>;
};

export function seo({
  path,
  title,
  description,
  breadcrumb,
  image = OG_IMAGE,
  imageAlt = OG_IMAGE_ALT,
  lang,
  extraLinks = [],
  jsonLd = [],
}: SeoInput) {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title.includes("InkSimulator") ? title : `${title} | InkSimulator`;
  const siteName = lang === "sv" ? BRAND_SV : BRAND_EN;
  const ld = [...jsonLd];
  if (breadcrumb) {
    ld.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: breadcrumb, item: url },
      ],
    });
  }
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteName },
      ...(lang ? [{ property: "og:locale", content: lang === "sv" ? "sv_SE" : "en_US" }] : []),
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:domain", content: new URL(SITE_URL).hostname },
      { name: "twitter:url", content: url },
      { property: "og:image:secure_url", content: image },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:image:alt", content: imageAlt },
    ],
    links: [{ rel: "canonical", href: url }, ...extraLinks],
    scripts: ld.map((obj) => ({
      type: "application/ld+json",
      children: JSON.stringify(obj),
    })),
  };
}
