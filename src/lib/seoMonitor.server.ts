/** Server-only SEO monitoring engine. Never import from client components. */
import {
  DESC_MAX,
  DESC_MIN,
  MONITORED_PAGES,
  TITLE_MAX,
  type SeoCheck,
  type SeoIssue,
  type SeoRunResult,
} from "./seoMonitor";

const UA = "InkSimulatorSeoMonitor/1.0";

async function get(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "*/*" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

function tag(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function metaContent(html: string, attr: "name" | "property", key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(
    `<meta[^>]+${attr}=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const b = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${escaped}["']`,
    "i",
  );
  return tag(html, a) ?? tag(html, b);
}

function canonicalHref(html: string) {
  const a = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i;
  const b = /<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i;
  return tag(html, a) ?? tag(html, b);
}

async function checkRobots(baseUrl: string, checks: SeoCheck[], issues: SeoIssue[]) {
  let res: Awaited<ReturnType<typeof get>>;
  try {
    res = await get(`${baseUrl}/robots.txt`);
  } catch {
    checks.push({ area: "robots", label: "robots.txt reachable", ok: false });
    issues.push({
      key: "robots:unreachable",
      severity: "error",
      area: "robots",
      target: "/robots.txt",
      message: "robots.txt could not be fetched.",
    });
    return;
  }

  if (!res.ok) {
    checks.push({
      area: "robots",
      label: "robots.txt reachable",
      ok: false,
      detail: `HTTP ${res.status}`,
    });
    issues.push({
      key: "robots:status",
      severity: "error",
      area: "robots",
      target: "/robots.txt",
      message: `robots.txt returned HTTP ${res.status}.`,
    });
    return;
  }
  checks.push({ area: "robots", label: "robots.txt reachable", ok: true });

  const blocksAll = /^\s*disallow:\s*\/\s*$/im.test(res.body);
  checks.push({
    area: "robots",
    label: "Crawling allowed",
    ok: !blocksAll,
  });
  if (blocksAll) {
    issues.push({
      key: "robots:disallow-all",
      severity: "error",
      area: "robots",
      target: "/robots.txt",
      message: "robots.txt contains 'Disallow: /' — the whole site is blocked from crawlers.",
    });
  }

  const hasSitemap = /^\s*sitemap:\s*https?:\/\//im.test(res.body);
  checks.push({ area: "robots", label: "Sitemap directive present", ok: hasSitemap });
  if (!hasSitemap) {
    issues.push({
      key: "robots:no-sitemap",
      severity: "warning",
      area: "robots",
      target: "/robots.txt",
      message: "robots.txt no longer references an absolute Sitemap URL.",
    });
  }
}

async function checkSitemap(baseUrl: string, checks: SeoCheck[], issues: SeoIssue[]) {
  let res: Awaited<ReturnType<typeof get>>;
  try {
    res = await get(`${baseUrl}/sitemap.xml`);
  } catch {
    checks.push({ area: "sitemap", label: "sitemap.xml reachable", ok: false });
    issues.push({
      key: "sitemap:unreachable",
      severity: "error",
      area: "sitemap",
      target: "/sitemap.xml",
      message: "sitemap.xml could not be fetched.",
    });
    return;
  }

  if (!res.ok || !res.body.includes("<urlset")) {
    checks.push({
      area: "sitemap",
      label: "sitemap.xml reachable",
      ok: false,
      detail: `HTTP ${res.status}`,
    });
    issues.push({
      key: "sitemap:invalid",
      severity: "error",
      area: "sitemap",
      target: "/sitemap.xml",
      message: `sitemap.xml is missing or not valid XML (HTTP ${res.status}).`,
    });
    return;
  }
  checks.push({ area: "sitemap", label: "sitemap.xml reachable", ok: true });

  const locs = [...res.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  checks.push({
    area: "sitemap",
    label: "Sitemap has entries",
    ok: locs.length > 0,
    detail: `${locs.length} URLs`,
  });
  if (locs.length === 0) {
    issues.push({
      key: "sitemap:empty",
      severity: "error",
      area: "sitemap",
      target: "/sitemap.xml",
      message: "sitemap.xml contains no <loc> entries.",
    });
    return;
  }

  const relative = locs.filter((l) => !/^https:\/\//i.test(l));
  checks.push({ area: "sitemap", label: "All URLs absolute https", ok: relative.length === 0 });
  if (relative.length > 0) {
    issues.push({
      key: "sitemap:relative-locs",
      severity: "error",
      area: "sitemap",
      target: "/sitemap.xml",
      message: `${relative.length} sitemap entries are not absolute https URLs (e.g. ${relative[0]}). Crawlers ignore them.`,
    });
  }

  const paths = new Set(
    locs.map((l) => {
      try {
        return new URL(l, baseUrl).pathname;
      } catch {
        return l;
      }
    }),
  );
  const missing = MONITORED_PAGES.filter((p) => !paths.has(p));
  checks.push({
    area: "sitemap",
    label: "Key pages listed",
    ok: missing.length === 0,
    detail: missing.length ? `missing ${missing.join(", ")}` : undefined,
  });
  for (const p of missing) {
    issues.push({
      key: `sitemap:missing:${p}`,
      severity: "warning",
      area: "sitemap",
      target: p,
      message: `${p} is a public page but has no sitemap entry.`,
    });
  }

  const wrongHost = locs.filter((l) => {
    try {
      return new URL(l).origin !== new URL(baseUrl).origin;
    } catch {
      return true;
    }
  });
  if (wrongHost.length > 0) {
    issues.push({
      key: "sitemap:wrong-origin",
      severity: "warning",
      area: "sitemap",
      target: "/sitemap.xml",
      message: `${wrongHost.length} sitemap entries point to another domain (e.g. ${wrongHost[0]}).`,
    });
  }
}

async function checkPage(
  baseUrl: string,
  path: string,
  checks: SeoCheck[],
  issues: SeoIssue[],
) {
  const url = `${baseUrl}${path === "/" ? "/" : path}`;
  let res: Awaited<ReturnType<typeof get>>;
  try {
    res = await get(url);
  } catch {
    checks.push({ area: "meta", label: `${path} reachable`, ok: false });
    issues.push({
      key: `meta:unreachable:${path}`,
      severity: "error",
      area: "meta",
      target: path,
      message: `${path} could not be fetched.`,
    });
    return;
  }

  if (!res.ok) {
    checks.push({ area: "meta", label: `${path} reachable`, ok: false, detail: `HTTP ${res.status}` });
    issues.push({
      key: `meta:status:${path}`,
      severity: "error",
      area: "meta",
      target: path,
      message: `${path} returned HTTP ${res.status}.`,
    });
    return;
  }

  const html = res.body;
  const title = tag(html, /<title[^>]*>([^<]*)<\/title>/i);
  const desc = metaContent(html, "name", "description");
  const canonical = canonicalHref(html);
  const ogUrl = metaContent(html, "property", "og:url");
  const ogTitle = metaContent(html, "property", "og:title");
  const ogImage = metaContent(html, "property", "og:image");
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  const problems: string[] = [];

  const push = (key: string, severity: IssueLevel, message: string) => {
    problems.push(message);
    issues.push({ key: `meta:${key}:${path}`, severity, area: "meta", target: path, message });
  };

  if (!title) push("title-missing", "error", `${path} has no <title>.`);
  else if (title.length > TITLE_MAX)
    push("title-long", "warning", `${path} title is ${title.length} chars (max ${TITLE_MAX}).`);
  else if (/lovable app|lovable generated project/i.test(title))
    push("title-default", "error", `${path} still uses a default placeholder title.`);

  if (!desc) push("desc-missing", "error", `${path} has no meta description.`);
  else if (desc.length < DESC_MIN || desc.length > DESC_MAX)
    push(
      "desc-length",
      "warning",
      `${path} description is ${desc.length} chars (should be ${DESC_MIN}–${DESC_MAX}).`,
    );

  if (!canonical) push("canonical-missing", "warning", `${path} has no canonical link.`);
  else if (!canonical.endsWith(path) && !(path === "/" && /\/$/.test(canonical)))
    push("canonical-mismatch", "warning", `${path} canonical points elsewhere (${canonical}).`);

  if (!ogUrl) push("ogurl-missing", "warning", `${path} has no og:url.`);
  if (!ogTitle) push("ogtitle-missing", "warning", `${path} has no og:title.`);
  if (!ogImage) push("ogimage-missing", "warning", `${path} has no og:image.`);
  if (h1Count === 0) push("h1-missing", "warning", `${path} has no <h1> heading.`);
  else if (h1Count > 1) push("h1-multiple", "warning", `${path} has ${h1Count} <h1> headings.`);

  checks.push({
    area: "meta",
    label: `${path} metadata`,
    ok: problems.length === 0,
    detail: problems.length ? `${problems.length} issue(s)` : title ?? undefined,
  });
}

type IssueLevel = SeoIssue["severity"];

async function checkSearchConsole(
  baseUrl: string,
  checks: SeoCheck[],
  issues: SeoIssue[],
) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const gscKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableKey || !gscKey) {
    checks.push({
      area: "search-console",
      label: "Search Console connected",
      ok: false,
      detail: "not configured",
    });
    return;
  }

  const gateway = "https://connector-gateway.lovable.dev/google_search_console";
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gscKey,
  };

  const target = new URL(baseUrl);
  let siteUrl: string | null = null;
  try {
    const listRes = await fetch(`${gateway}/webmasters/v3/sites`, { headers });
    if (!listRes.ok) {
      const body = await listRes.text();
      console.error(`[seo-monitor] GSC sites failed [${listRes.status}]: ${body}`);
      checks.push({
        area: "search-console",
        label: "Search Console properties",
        ok: false,
        detail: `HTTP ${listRes.status}`,
      });
      return;
    }
    const { siteEntry = [] } = (await listRes.json()) as {
      siteEntry?: { siteUrl: string; permissionLevel?: string }[];
    };
    const matches = siteEntry.filter((e) => {
      if (e.permissionLevel === "siteUnverifiedUser") return false;
      if (e.siteUrl.startsWith("sc-domain:")) {
        const d = e.siteUrl.slice("sc-domain:".length).toLowerCase();
        const h = target.hostname.toLowerCase();
        return h === d || h.endsWith(`.${d}`);
      }
      try {
        return target.href.startsWith(new URL(e.siteUrl).href);
      } catch {
        return false;
      }
    });
    // Prefer the exact root URL-prefix property for this origin.
    siteUrl =
      matches.find((e) => e.siteUrl === `${target.origin}/`)?.siteUrl ??
      matches[0]?.siteUrl ??
      null;
  } catch (err) {
    console.error("[seo-monitor] GSC list error", err);
  }

  if (!siteUrl) {
    checks.push({
      area: "search-console",
      label: "Verified property for this site",
      ok: false,
      detail: "none found",
    });
    issues.push({
      key: "gsc:no-property",
      severity: "warning",
      area: "search-console",
      target: baseUrl,
      message: "No verified Search Console property covers this site, so crawl data can't be read.",
    });
    return;
  }

  checks.push({
    area: "search-console",
    label: "Verified property",
    ok: true,
    detail: siteUrl,
  });

  // Sitemap processing status as reported by Google.
  try {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const path = `${gateway}/webmasters/v3/sites/${encodeURIComponent(
      siteUrl,
    )}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
    const res = await fetch(path, { headers });
    if (res.ok) {
      const data = (await res.json()) as {
        errors?: string | number;
        warnings?: string | number;
        lastDownloaded?: string;
        isPending?: boolean;
      };
      const errors = Number(data.errors ?? 0);
      const warnings = Number(data.warnings ?? 0);
      checks.push({
        area: "search-console",
        label: "Google sitemap status",
        ok: errors === 0,
        detail: `${errors} errors, ${warnings} warnings${
          data.lastDownloaded ? `, last read ${data.lastDownloaded.slice(0, 10)}` : ""
        }`,
      });
      if (errors > 0) {
        issues.push({
          key: "gsc:sitemap-errors",
          severity: "error",
          area: "search-console",
          target: "/sitemap.xml",
          message: `Google reports ${errors} error(s) for the submitted sitemap. The exact cause is only visible in Search Console.`,
        });
      } else if (warnings > 0) {
        issues.push({
          key: "gsc:sitemap-warnings",
          severity: "warning",
          area: "search-console",
          target: "/sitemap.xml",
          message: `Google reports ${warnings} warning(s) for the submitted sitemap.`,
        });
      }
    } else if (res.status === 404) {
      checks.push({
        area: "search-console",
        label: "Google sitemap status",
        ok: false,
        detail: "not submitted",
      });
      issues.push({
        key: "gsc:sitemap-not-submitted",
        severity: "warning",
        area: "search-console",
        target: "/sitemap.xml",
        message: "The sitemap is not submitted to Search Console for this property.",
      });
    } else {
      const body = await res.text();
      console.error(`[seo-monitor] GSC sitemap status [${res.status}]: ${body}`);
    }
  } catch (err) {
    console.error("[seo-monitor] GSC sitemap error", err);
  }

  // Homepage indexing state.
  try {
    const res = await fetch(`${gateway}/v1/urlInspection/index:inspect`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: `${baseUrl}/`, siteUrl }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        inspectionResult?: {
          indexStatusResult?: { verdict?: string; coverageState?: string };
        };
      };
      const status = data.inspectionResult?.indexStatusResult;
      const verdict = status?.verdict ?? "UNKNOWN";
      checks.push({
        area: "search-console",
        label: "Homepage indexing",
        ok: verdict === "PASS",
        detail: status?.coverageState ?? verdict,
      });
      if (verdict === "FAIL") {
        issues.push({
          key: "gsc:home-not-indexed",
          severity: "error",
          area: "search-console",
          target: "/",
          message: `Google reports the homepage as not indexed (${
            status?.coverageState ?? "no detail"
          }).`,
        });
      }
    } else {
      const body = await res.text();
      console.error(`[seo-monitor] GSC inspect [${res.status}]: ${body}`);
    }
  } catch (err) {
    console.error("[seo-monitor] GSC inspect error", err);
  }
}

export async function runSeoMonitor(baseUrl: string): Promise<SeoRunResult> {
  const base = baseUrl.replace(/\/+$/, "");
  const checks: SeoCheck[] = [];
  const issues: SeoIssue[] = [];

  await Promise.all([
    checkRobots(base, checks, issues),
    checkSitemap(base, checks, issues),
  ]);

  for (const page of MONITORED_PAGES) {
    await checkPage(base, page, checks, issues);
  }

  await checkSearchConsole(base, checks, issues);

  return { baseUrl: base, ranAt: new Date().toISOString(), checks, issues };
}
