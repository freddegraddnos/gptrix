import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a real test notice to the studio's chosen recipient; marks it tested only on success. */
export const sendOnboardingTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { channel: "email" | "sms"; lang: "sv" | "en" }) => ({
    channel: d.channel === "sms" ? "sms" : "email",
    lang: d.lang === "sv" ? "sv" : "en",
  }) as const)
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase
      .from("artist_profiles")
      .select("studio_name, contact_email, notify_email, notify_phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!p) return { ok: false, reason: "no_profile" as const };
    if (data.channel === "sms") {
      if (!p.notify_phone) return { ok: false, reason: "no_number" as const };
      const { sendSms } = await import("@/lib/sms.server");
      const r = await sendSms(p.notify_phone, data.lang === "sv"
        ? "InkSimulator: testavisering. Här får du nya kundförfrågningar."
        : "InkSimulator: test notice. New client requests arrive here.");
      if (!r.ok) return { ok: false, reason: "failed" as const };
      await context.supabase.from("artist_profiles").update({ notify_test_sms_at: new Date().toISOString() }).eq("user_id", context.userId);
      return { ok: true as const };
    }
    const to = (p.notify_email || p.contact_email || "").trim();
    if (!to) return { ok: false, reason: "no_email" as const };
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const r = await sendTemplateEmail("studio-test-notice", to, { templateData: { studioName: p.studio_name, lang: data.lang } });
      if (!r.sent) return { ok: false, reason: "suppressed" as const };
    } catch (e) {
      console.error("onboarding test email failed", e);
      return { ok: false, reason: "failed" as const };
    }
    await context.supabase.from("artist_profiles").update({ notify_test_email_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { ok: true as const };
  });
