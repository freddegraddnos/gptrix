import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OtpEvent = {
  id: string;
  email: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type VerificationSubmission = {
  userId: string;
  studioName: string;
  handle: string | null;
  city: string | null;
  contactEmail: string | null;
  website: string | null;
  status: string;
  verified: boolean;
  note: string | null;
  emailVerifiedAt: string | null;
  documentSubmittedAt: string | null;
  documentUrl: string | null;
  otps: OtpEvent[];
};

async function assertAdmin(supabase: {
  rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => Promise<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

/** All studios waiting for (or already through) verification review. */
export const listVerificationSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ status: z.enum(["pending", "verified", "rejected", "all"]).optional() })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<VerificationSubmission[]> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("artist_profiles")
      .select(
        "user_id, studio_name, handle, city, contact_email, website, verification_status, verified, verification_note, email_verified_at, document_submitted_at, document_path",
      )
      .order("document_submitted_at", { ascending: false, nullsFirst: false })
      .limit(200);

    const status = data.status ?? "pending";
    if (status !== "all") query = query.eq("verification_status", status);

    const { data: rows, error } = await query;
    if (error) {
      console.error("listVerificationSubmissions failed", error);
      throw new Error("Could not load verification submissions.");
    }

    const out: VerificationSubmission[] = [];
    for (const row of rows ?? []) {
      let documentUrl: string | null = null;
      if (row.document_path) {
        const signed = await supabaseAdmin.storage
          .from("verification")
          .createSignedUrl(row.document_path, 60 * 30);
        documentUrl = signed.data?.signedUrl ?? null;
      }
      const { data: otps } = await supabaseAdmin
        .from("artist_email_otps")
        .select("id, email, attempts, created_at, expires_at, consumed_at")
        .eq("artist_user_id", row.user_id)
        .order("created_at", { ascending: false })
        .limit(20);

      out.push({
        userId: row.user_id,
        studioName: row.studio_name,
        handle: row.handle,
        city: row.city,
        contactEmail: row.contact_email,
        website: row.website,
        status: row.verification_status,
        verified: Boolean(row.verified),
        note: row.verification_note,
        emailVerifiedAt: row.email_verified_at,
        documentSubmittedAt: row.document_submitted_at,
        documentUrl,
        otps: (otps ?? []).map((o) => ({
          id: o.id,
          email: o.email,
          attempts: o.attempts,
          createdAt: o.created_at,
          expiresAt: o.expires_at,
          consumedAt: o.consumed_at,
        })),
      });
    }
    return out;
  });

/** Approve or reject a studio's verification documents. */
export const reviewVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const approve = data.action === "approve";
    const { error } = await supabaseAdmin
      .from("artist_profiles")
      .update({
        verified: approve,
        verified_at: approve ? new Date().toISOString() : null,
        verification_status: approve ? "verified" : "rejected",
        verification_note: data.note ?? null,
      })
      .eq("user_id", data.userId);
    if (error) {
      console.error("reviewVerification failed", error);
      return { ok: false as const, error: "Could not save the review." };
    }
    return { ok: true as const };
  });
