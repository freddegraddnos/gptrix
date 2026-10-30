/**
 * Hidden studio signup (/adminsignup). Creates the account straight away with
 * no email verification and an already approved studio profile.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStudioPlatformAdmin } from "@/lib/studioPlatformAdmin";
import { isValidOptionalWebsite, normalizeExternalUrl } from "@/lib/externalUrl";

const optionalText = (max: number) => z.string().max(max).optional();

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  studioName: z.string().min(2).max(120),
  city: optionalText(120),
  address: optionalText(300),
  phone: optionalText(60),
  website: optionalText(300).refine(isValidOptionalWebsite, "Enter a valid website address."),
  instagram: optionalText(200),
  socialUrl: optionalText(300),
  bio: optionalText(2000),
  code: z.string().min(1).max(120),
});

/** Private access code for the hidden signup page. Server-side only. */
const ACCESS_CODE = "FRITZ";
const codeMatches = (value: string) => value.trim().toUpperCase() === ACCESS_CODE;

export const verifyAdminSignupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ code: z.string().max(120) }).parse(raw))
  .handler(async ({ data, context }) => {
    await requireStudioPlatformAdmin(context.supabase, context.userId);
    return { ok: codeMatches(data.code) };
  });

/** Empty strings become null so optional fields stay blank on the profile. */
const clean = (value?: string) => value?.trim() || null;

export const createApprovedStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => schema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireStudioPlatformAdmin(context.supabase, context.userId);
    if (!codeMatches(data.code)) throw new Error("Wrong access code.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account.");

    const { error: profErr } = await supabaseAdmin.from("artist_profiles").upsert(
      {
        user_id: created.user.id,
        studio_name: data.studioName.trim(),
        city: clean(data.city),
        address: clean(data.address),
        phone: clean(data.phone),
        website: data.website?.trim() ? normalizeExternalUrl(data.website) : null,
        instagram: clean(data.instagram),
        social_url: clean(data.socialUrl),
        bio: clean(data.bio),
        contact_email: data.email,
        must_change_password: true,
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        status: "approved",
      },
      { onConflict: "user_id" },
    );
    if (profErr) throw new Error(profErr.message);

    return { ok: true, userId: created.user.id };
  });
