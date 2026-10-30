import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SeoRunRow, SeoSettings } from "./seoMonitor";

export const getSeoHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./seoMonitorAdmin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: settings }, { data: runs }] = await Promise.all([
      supabaseAdmin
        .from("seo_monitor_settings")
        .select("alert_email, email_enabled, base_url")
        .eq("id", true)
        .maybeSingle(),
      supabaseAdmin
        .from("seo_monitor_runs")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(20),
    ]);

    return {
      settings: (settings ?? {
        alert_email: null,
        email_enabled: true,
        base_url: "https://www.inksimulator.com",
      }) as SeoSettings,
      runs: (runs ?? []) as unknown as SeoRunRow[],
    };
  });

export const updateSeoSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        alertEmail: z.string().email().nullable().optional(),
        emailEnabled: z.boolean().optional(),
        baseUrl: z.string().url().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./seoMonitorAdmin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = { id: true, updated_at: new Date().toISOString() };
    if (data.alertEmail !== undefined) patch.alert_email = data.alertEmail;
    if (data.emailEnabled !== undefined) patch.email_enabled = data.emailEnabled;
    if (data.baseUrl !== undefined) patch.base_url = data.baseUrl.replace(/\/+$/, "");

    const { error } = await supabaseAdmin
      .from("seo_monitor_settings")
      .upsert(patch as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runSeoCheckNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./seoMonitorAdmin.server");
    await assertAdmin(context.supabase, context.userId);
    const { runSeoMonitor } = await import("@/lib/seoMonitor.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("seo_monitor_settings")
      .select("base_url")
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
    const newCount = result.issues.filter((i) => !previousKeys.has(i.key)).length;

    await supabaseAdmin.from("seo_monitor_runs").insert({
      base_url: baseUrl,
      source: "manual",
      issue_count: result.issues.length,
      new_issue_count: newCount,
      checks: result.checks as unknown as never,
      issues: result.issues as unknown as never,
      emailed: false,
    });

    return { issues: result.issues.length, newIssues: newCount };
  });
