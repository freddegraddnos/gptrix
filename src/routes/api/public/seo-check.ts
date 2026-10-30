import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily automated SEO check.
 * Called by a scheduler with the `x-seo-monitor-secret` header.
 * Runs sitemap/robots/meta/Search Console checks, stores the run and
 * emails an alert when new issues appear.
 */
async function handle(request: Request) {
  const accepted = [
    process.env["SEO_MONITOR_CRON_SECRET"],
    process.env["SEO_MONITOR_SECRET"],
  ].filter(Boolean) as string[];
  const provided = request.headers.get("x-seo-monitor-secret");
  if (accepted.length === 0 || !provided || !accepted.includes(provided)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { runSeoMonitor } = await import("@/lib/seoMonitor.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: settings } = await supabaseAdmin
    .from("seo_monitor_settings")
    .select("alert_email, email_enabled, base_url")
    .eq("id", true)
    .maybeSingle();

  const baseUrl = settings?.base_url || "https://www.inksimulator.com";
  const result = await runSeoMonitor(baseUrl);

  const { data: previous } = await supabaseAdmin
    .from("seo_monitor_runs")
    .select("issues")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousKeys = new Set(
    ((previous?.issues as { key?: string }[] | null) ?? [])
      .map((i) => i?.key)
      .filter(Boolean) as string[],
  );
  const newIssues = result.issues.filter((i) => !previousKeys.has(i.key));

  let emailed = false;
  if (newIssues.length > 0 && settings?.email_enabled && settings.alert_email) {
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const res = await sendTemplateEmail("seo-alert", settings.alert_email, {
        templateData: {
          siteUrl: baseUrl,
          issues: newIssues.slice(0, 12),
          totalCount: result.issues.length,
          dashboardUrl: `${baseUrl}/seo-health`,
        },
      });
      emailed = res.sent;
    } catch (err) {
      console.error("[seo-monitor] alert email failed", err);
    }
  }

  const { error } = await supabaseAdmin.from("seo_monitor_runs").insert({
    base_url: baseUrl,
    source: "cron",
    issue_count: result.issues.length,
    new_issue_count: newIssues.length,
    checks: result.checks as unknown as never,
    issues: result.issues as unknown as never,
    emailed,
  });
  if (error) console.error("[seo-monitor] insert failed", error);

  return Response.json({
    ok: true,
    baseUrl,
    issues: result.issues.length,
    newIssues: newIssues.length,
    emailed,
  });
}

export const Route = createFileRoute("/api/public/seo-check")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
