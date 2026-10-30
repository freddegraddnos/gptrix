import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type VerificationState = {
  verified: boolean;
  verificationStatus: string;
  emailVerified: boolean;
  documentSubmitted: boolean;
  contactEmail: string | null;
  note: string | null;
};

/** Current verification state for the signed-in studio. */
export const getVerificationState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VerificationState> => {
    const { data } = await context.supabase
      .from("artist_profiles")
      .select(
        "verified, verification_status, verification_note, email_verified_at, document_path, contact_email",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    let emailVerified = Boolean(data?.email_verified_at);

    // If the signed-in account already confirmed this same address in auth,
    // don't ask the studio to verify it a second time.
    if (!emailVerified && data?.contact_email) {
      const { data: authUser } = await context.supabase.auth.getUser();
      const u = authUser?.user;
      const confirmed = Boolean(u?.email_confirmed_at);
      const same =
        (u?.email ?? "").trim().toLowerCase() === data.contact_email.trim().toLowerCase();
      if (confirmed && same) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: verifiedError } = await supabaseAdmin
          .from("artist_profiles")
          .update({ email_verified_at: new Date().toISOString() })
          .eq("user_id", context.userId);
        if (verifiedError) throw new Error("Could not save email verification. Please try again.");
        emailVerified = true;
      }
    }

    return {
      verified: Boolean(data?.verified),
      verificationStatus: data?.verification_status ?? "unverified",
      emailVerified,
      documentSubmitted: Boolean(data?.document_path),
      contactEmail: data?.contact_email ?? null,
      note: data?.verification_note ?? null,
    };
  });


/** Sends a 6-digit one-time code to the studio's contact email. */
export const sendStudioOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await context.supabase
      .from("artist_profiles")
      .select("studio_name, contact_email")
      .eq("user_id", userId)
      .maybeSingle();
    const email = profile?.contact_email?.trim();
    if (!email) return { ok: false as const, error: "Add a contact email to your profile first." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Simple rate limit: max 5 codes per hour.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("artist_email_otps")
      .select("id", { count: "exact", head: true })
      .eq("artist_user_id", userId)
      .gt("created_at", since);
    if ((count ?? 0) >= 5) return { ok: false as const, error: "Too many codes requested. Try again later." };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabaseAdmin.from("artist_email_otps").insert({
      artist_user_id: userId,
      email,
      code_hash: await sha256(`${userId}:${code}`),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("studio-otp", email, {
        templateData: { code, studioName: profile?.studio_name ?? "your studio" },
      });
    } catch (err) {
      console.error("[verify] otp email failed", err);
      return { ok: false as const, error: "Could not send the code right now." };
    }
    return { ok: true as const, email };
  });

/** Confirms the emailed code and marks the contact email as verified. */
export const verifyStudioOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ code: z.string().min(4).max(10) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: otp } = await supabaseAdmin
      .from("artist_email_otps")
      .select("id, code_hash, expires_at, consumed_at, attempts")
      .eq("artist_user_id", userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) return { ok: false as const, error: "Request a new code." };
    if (new Date(otp.expires_at).getTime() < Date.now())
      return { ok: false as const, error: "The code has expired." };
    if (otp.attempts >= 6) return { ok: false as const, error: "Too many attempts. Request a new code." };

    const hash = await sha256(`${userId}:${data.code.trim()}`);
    if (hash !== otp.code_hash) {
      await supabaseAdmin
        .from("artist_email_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      return { ok: false as const, error: "Wrong code." };
    }

    await supabaseAdmin
      .from("artist_email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    const { data: profile } = await supabaseAdmin
      .from("artist_profiles")
      .select("document_path")
      .eq("user_id", userId)
      .maybeSingle();

    const fullyVerified = Boolean(profile?.document_path);
    await supabaseAdmin
      .from("artist_profiles")
      .update({
        email_verified_at: new Date().toISOString(),
        verified: fullyVerified,
        verified_at: fullyVerified ? new Date().toISOString() : null,
        verification_status: fullyVerified ? "verified" : "pending",
      })
      .eq("user_id", userId);

    return { ok: true as const, verified: fullyVerified };
  });

/** Registers an uploaded business document (already stored in the private bucket). */
export const submitStudioDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ path: z.string().min(3).max(400) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.path.startsWith(`${userId}/`)) return { ok: false as const, error: "Invalid file." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("artist_profiles")
      .select("email_verified_at")
      .eq("user_id", userId)
      .maybeSingle();

    const fullyVerified = Boolean(profile?.email_verified_at);
    const { error } = await supabaseAdmin
      .from("artist_profiles")
      .update({
        document_path: data.path,
        document_submitted_at: new Date().toISOString(),
        verified: fullyVerified,
        verified_at: fullyVerified ? new Date().toISOString() : null,
        verification_status: fullyVerified ? "verified" : "pending",
      })
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: "Could not save the document." };
    return { ok: true as const, verified: fullyVerified };
  });
