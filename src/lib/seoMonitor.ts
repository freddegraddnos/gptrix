/** Shared types + config for automated SEO monitoring (client-safe). */

export type IssueSeverity = "error" | "warning";

export interface SeoIssue {
  /** Stable identity used to detect "new" issues between runs. */
  key: string;
  severity: IssueSeverity;
  /** Which area the issue belongs to. */
  area: "sitemap" | "robots" | "meta" | "search-console";
  /** Page path or resource the issue relates to. */
  target: string;
  message: string;
}

export interface SeoCheck {
  area: SeoIssue["area"];
  label: string;
  ok: boolean;
  detail?: string;
}

export interface SeoRunResult {
  baseUrl: string;
  ranAt: string;
  checks: SeoCheck[];
  issues: SeoIssue[];
}

export interface SeoRunRow {
  id: string;
  ran_at: string;
  base_url: string;
  source: string;
  issue_count: number;
  new_issue_count: number;
  checks: SeoCheck[];
  issues: SeoIssue[];
  emailed: boolean;
}

export interface SeoSettings {
  alert_email: string | null;
  email_enabled: boolean;
  base_url: string;
}

/** Public pages whose head metadata is checked on every run. */
export const MONITORED_PAGES = [
  "/",
  "/ar",
  "/library",
  "/community",
  "/artists",
  "/studios",
  "/generator",
  "/guides/placement-guide",
] as const;

export const TITLE_MAX = 60;
export const DESC_MIN = 50;
export const DESC_MAX = 160;
