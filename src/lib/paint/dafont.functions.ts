/**
 * Font catalogue backed by dafont.com.
 *
 * The browser cannot talk to dafont directly (no CORS, and downloads arrive as
 * .zip archives), so these server functions do the work: search the catalogue,
 * then fetch the archive, unzip it in memory and hand back the raw font file as
 * base64. The client registers that with the FontFace API, so the artist never
 * touches a zip file.
 *
 * Fonts on dafont carry their own licences (often "free for personal use"), so
 * the licence string is returned with every hit and shown in the UI.
 */

import { createServerFn } from "@tanstack/react-start";
import { unzipSync } from "fflate";
import { z } from "zod";

const BASE = "https://www.dafont.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export interface DafontHit {
  /** dafont slug, e.g. "alysa" — also the download key. */
  slug: string;
  name: string;
  author: string;
  license: string;
  /** Absolute preview image URL. */
  preview: string | null;
}

/** dafont serves ISO-8859-1, so decode explicitly instead of trusting utf-8. */
async function fetchLatin1(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html", Referer: BASE + "/" },
  });
  if (!res.ok) throw new Error(`dafont responded ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buf);
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Parses the search/browse listing. Each font is one `lv1left` block followed by
 * its licence note, download link and preview image, so we split on the block
 * and read the pieces that follow.
 */
function parseListing(html: string): DafontHit[] {
  const hits: DafontHit[] = [];
  const chunks = html.split('<div class="lv1left');
  for (const chunk of chunks.slice(1)) {
    const dl = /href="(?:https?:)?\/\/dl\.dafont\.com\/dl\/\?f=([a-z0-9_.-]+)"/i.exec(chunk);
    if (!dl) continue;
    const slug = dl[1]!;

    // Drop the little "has accents / has euro" badge spans before reading the
    // name, otherwise their glyph entities end up inside the font title.
    const head = chunk
      .slice(0, chunk.indexOf("</div>"))
      .replace(/<span[^>]*>[\s\S]*?<\/span>/gi, "");
    const authorMatch = /\bby\s*<a[^>]*>([\s\S]*?)<\/a>/i.exec(head);
    // The "top fonts" listing prefixes each name with its rank ("1. Matcha Mint").
    const name = stripTags(head.split(/\bby\s*<a/i)[0] ?? "")
      .replace(/^dfbg">/, "")
      .replace(/^\d+\.\s*/, "");
    const license = /faq\.php#copyright"[^>]*>([\s\S]*?)<\/a>/i.exec(chunk);
    const preview = /background-image:url\((\/img\/preview\/[^)]+)\)/i.exec(chunk);

    hits.push({
      slug,
      name: name || slug,
      author: authorMatch ? stripTags(authorMatch[1]!) : "",
      license: license ? stripTags(license[1]!) : "Unknown license",
      preview: preview ? BASE + preview[1]! : null,
    });
  }
  return hits;
}

/** Free-text search in dafont's catalogue. Empty query returns the top fonts. */
export const searchDafont = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({ query: z.string().trim().max(80).default(""), page: z.number().int().min(1).max(20).default(1) })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ hits: DafontHit[] }> => {
    const url = data.query
      ? `${BASE}/search.php?q=${encodeURIComponent(data.query)}&page=${data.page}`
      : `${BASE}/top.php?page=${data.page}`;
    const html = await fetchLatin1(url);
    return { hits: parseListing(html).slice(0, 24) };
  });

const FONT_FILE = /\.(ttf|otf)$/i;

/**
 * Downloads a font's archive and returns the first usable face inside it as
 * base64, ready for `new FontFace(...)`.
 */
export const downloadDafontFont = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ slug: z.string().regex(/^[a-z0-9_.-]+$/i) }).parse(data))
  .handler(async ({ data }): Promise<{ fileName: string; base64: string }> => {
    const res = await fetch(`https://dl.dafont.com/dl/?f=${encodeURIComponent(data.slug)}`, {
      headers: { "User-Agent": UA, Referer: `${BASE}/${data.slug}.font` },
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const zip = new Uint8Array(await res.arrayBuffer());

    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(zip);
    } catch {
      throw new Error("Could not unzip the archive");
    }

    // Prefer a regular weight over "italic"/"bold" variants when several exist.
    const names = Object.keys(files).filter((n) => FONT_FILE.test(n) && !n.startsWith("__MACOSX"));
    if (names.length === 0) throw new Error("The archive contained no ttf/otf file");
    names.sort((a, b) => score(a) - score(b) || a.length - b.length);
    const pick = names[0]!;
    const bytes = files[pick]!;
    if (bytes.byteLength > 3 * 1024 * 1024) throw new Error("Font file is too large (max 3 MB)");

    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return {
      fileName: pick.split("/").pop() ?? pick,
      base64: btoa(binary),
    };
  });

function score(name: string): number {
  const n = name.toLowerCase();
  if (/(italic|oblique|bold|light|thin)/.test(n)) return 1;
  return 0;
}
