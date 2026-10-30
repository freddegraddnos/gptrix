import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("artist_profiles")
      .select("notify_phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data?.notify_phone) return { ok: false, reason: "no_number" };
    const { sendSms } = await import("@/lib/sms.server");
    return sendSms(data.notify_phone, "InkSimulator: test-SMS. Här får du nya kundförfrågningar.");
  });
