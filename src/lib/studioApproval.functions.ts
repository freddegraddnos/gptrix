import { publicSiteUrl } from "@/lib/publicOrigin";
/**
 * New studios are not published straight away — they fill in their profile and
 * then ask to join. InkSimulator approves or rejects from a one-click email link.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studioApprovalTokenDigest } from "@/lib/studioApprovalToken";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export type StudioApprovalState = {
  status: "none" | "pending" | "requested" | "approved" | "rejected";
  requestedAt: string | null;
};

export const getStudioApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudioApprovalState> => {
    const { data } = await context.supabase
      .from("artist_profiles")
      .select("approval_status, approval_requested_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { status: "none", requestedAt: null };
    return {
      status: (data.approval_status ?? "pending") as StudioApprovalState["status"],
      requestedAt: data.approval_requested_at ?? null,
    };
  });

export const requestStudioApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("artist_profiles")
      .select("studio_name, city, contact_email, website, instagram, approval_status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Fill in your studio profile first.");
    if (profile.approval_status === "approved") return { ok: true, already: true };
    if (!profile.studio_name?.trim()) throw new Error("Add your studio name first.");

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("artist_profiles")
      .update({
        approval_status: "requested",
        approval_requested_at: new Date().toISOString(),
        approval_token: await studioApprovalTokenDigest(token),
        approval_token_used_at: null,
      })
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    const base = publicSiteUrl("/api/public/studio-approval");
    await sendTemplateEmail("studio-approval-request", "1891frs@gmail.com", {
      templateData: {
        studioName: profile.studio_name,
        city: profile.city ?? "",
        contactEmail: profile.contact_email ?? "",
        website: profile.website ?? "",
        instagram: profile.instagram ?? "",
        approveUrl: `${base}?token=${token}&action=approve`,
        rejectUrl: `${base}?token=${token}&action=reject`,
      },
      idempotencyKey: `studio-approval-${token}`,
    });

    return { ok: true, already: false };
  });
