import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  getSeoHealth,
  runSeoCheckNow,
  updateSeoSettings,
} from "@/lib/seoMonitor.functions";
import type { SeoCheck, SeoIssue } from "@/lib/seoMonitor";

export const Route = createFileRoute("/seo-health")({
  head: () => ({
    meta: [
      { title: "SEO health — InkSimulator" },
      {
        name: "description",
        content:
          "Admin dashboard for InkSimulator's automated SEO monitoring: sitemap, robots.txt, meta tags and Search Console signals.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "InkSimulator — SEO health" },
      {
        property: "og:description",
        content: "Automated sitemap, meta tag and Search Console monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SeoHealthPage,
});

function areaLabel(area: string) {
  switch (area) {
    case "sitemap":
      return "Sitemap";
    case "robots":
      return "robots.txt";
    case "meta":
      return "Meta tags";
    default:
      return "Search Console";
  }
}

function SeoHealthPage() {
  const qc = useQueryClient();
  const fetchHealth = useServerFn(getSeoHealth);
  const saveSettings = useServerFn(updateSeoSettings);
  const runNow = useServerFn(runSeoCheckNow);
  const [email, setEmail] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["seo-health"],
    queryFn: () => fetchHealth(),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (input: { alertEmail?: string | null; emailEnabled?: boolean }) =>
      saveSettings({ data: input }),
    onSuccess: () => {
      toast.success("Alert settings saved");
      qc.invalidateQueries({ queryKey: ["seo-health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (res) => {
      toast.success(`Check complete — ${res.issues} issue(s), ${res.newIssues} new`);
      qc.invalidateQueries({ queryKey: ["seo-health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = data?.runs?.[0];
  const checks = (latest?.checks ?? []) as SeoCheck[];
  const issues = (latest?.issues ?? []) as SeoIssue[];
  const settings = data?.settings;
  const emailValue = email ?? settings?.alert_email ?? "";

  return (
    <AppShell>
      <TopBar title="SEO health" />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">
        <h1 className="text-2xl font-bold tracking-tight">SEO health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Automated daily checks of the sitemap, robots.txt, page metadata and
          Google Search Console signals.
        </p>

        {isLoading && (
          <div className="mt-10 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <ShieldAlert className="mt-0.5 size-5 text-destructive" />
            <div className="text-sm">
              <p className="font-medium">Admin access required</p>
              <p className="text-muted-foreground">
                This page is only available to InkSimulator administrators.
              </p>
            </div>
          </div>
        )}

        {data && (
          <>
            <section className="mt-6 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Latest run</p>
                  <p className="text-xs text-muted-foreground">
                    {latest
                      ? `${new Date(latest.ran_at).toLocaleString("en-US")} · ${
                          latest.source
                        }`
                      : "No checks have run yet."}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => run.mutate()}
                  disabled={run.isPending}
                >
                  {run.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Run now
                </Button>
              </div>

              {latest && (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xl font-bold">{latest.issue_count}</p>
                    <p className="text-[11px] text-muted-foreground">Open issues</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xl font-bold">{latest.new_issue_count}</p>
                    <p className="text-[11px] text-muted-foreground">New</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xl font-bold">{checks.filter((c) => c.ok).length}</p>
                    <p className="text-[11px] text-muted-foreground">Checks passing</p>
                  </div>
                </div>
              )}
            </section>

            {issues.length > 0 && (
              <section className="mt-4 rounded-2xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Issues</h2>
                <ul className="mt-3 space-y-2">
                  {issues.map((issue) => (
                    <li key={issue.key} className="flex items-start gap-3 text-sm">
                      {issue.severity === "error" ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                      )}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {areaLabel(issue.area)} · {issue.target}
                        </p>
                        <p>{issue.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {checks.length > 0 && (
              <section className="mt-4 rounded-2xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">All checks</h2>
                <ul className="mt-3 space-y-1.5">
                  {checks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {c.ok ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <span className="flex-1">{c.label}</span>
                      {c.detail && (
                        <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                          {c.detail}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-4 rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Email alerts</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A digest is sent whenever a new sitemap, crawl or meta tag issue
                appears.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm">Send email alerts</span>
                <Switch
                  checked={settings?.email_enabled ?? true}
                  onCheckedChange={(v) => save.mutate({ emailEnabled: v })}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailValue}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    save.mutate({ alertEmail: emailValue.trim() || null })
                  }
                  disabled={save.isPending}
                >
                  Save
                </Button>
              </div>
            </section>

            {data.runs.length > 1 && (
              <section className="mt-4 rounded-2xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">History</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {data.runs.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {new Date(r.ran_at).toLocaleString("en-US")}
                      </span>
                      <span>
                        {r.issue_count} issue{r.issue_count === 1 ? "" : "s"}
                        {r.new_issue_count > 0 && (
                          <span className="ml-1 text-amber-400">
                            (+{r.new_issue_count})
                          </span>
                        )}
                        {r.emailed && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            emailed
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
