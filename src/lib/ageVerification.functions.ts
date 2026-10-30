import { publicSiteUrl } from "@/lib/publicOrigin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Age verification before booking. The studio asks, the customer uploads a
 * photo of their ID, the studio approves or rejects it. The photo is deleted
 * the moment it has been reviewed — only the outcome and the birth year stay.
 */

const BUCKET = "attachments";

async function isStudioStaff(
  supabase: { rpc: typeof import("@/integrations/supabase/client")["supabase"]["rpc"] },
  artistId: string,
  userId: string,
) {
  const { data } = await supabase.rpc("is_studio_staff", { _studio: artistId, _user: userId });
  return Boolean(data);
}

async function loadProject(projectId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("artist_client_projects")
    .select("id, artist_id, client_user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) throw new Error("Project not found.");
  return data;
}

async function notifyParty(projectId: string, recipient: string | null, actorId: string, title: string, body: string, key: string, studioSide: boolean) {
  if (!recipient) return;
  const url = studioSide ? `/artists/requests/${projectId}` : `/requests/${projectId}`;
  const { notifyUser } = await import("@/lib/notify.server");
  await notifyUser(recipient, {
    kind: "change",
    title,
    body,
    url,
    inApp: { kind: "message", actorId },
    email: {
      template: "new-message",
      templateData: { senderName: "InkSimulator", preview: body, link: publicSiteUrl(`${url}`) },
      idempotencyKey: key,
    },
  }).catch(() => undefined);
}

/** The studio asks the customer to prove their age before a time is booked. */
export const requestAgeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), minAge: z.number().int().min(16).max(30).default(18) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const project = await loadProject(data.projectId);
    if (!(await isStudioStaff(context.supabase, project.artist_id, context.userId))) {
      throw new Error("Only the studio can request age verification.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("artist_project_age_verifications")
      .upsert(
        {
          project_id: project.id,
          requested_by: context.userId,
          min_age: data.minAge,
          status: "open",
          storage_path: null,
          birth_year: null,
          reviewed_by: null,
          reviewed_at: null,
          reject_reason: null,
          submitted_at: null,
        },
        { onConflict: "project_id" },
      )
      .select()
      .single();
    if (error || !row) throw error ?? new Error("Could not request age verification.");
    await supabaseAdmin.from("artist_client_projects").update({ age_verification_status: "open" }).eq("id", project.id);
    await notifyParty(
      project.id,
      project.client_user_id,
      context.userId,
      "Age verification needed",
      `The studio needs to verify you are at least ${data.minAge} before booking a time.`,
      `age-verification-request-${row.id}-${row.created_at}`,
      false,
    );
    return row;
  });

/** The customer submits a photo of their ID (already uploaded to storage). */
export const submitAgeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), storagePath: z.string().min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const project = await loadProject(data.projectId);
    if (project.client_user_id !== context.userId) throw new Error("Only the customer can submit their ID.");
    if (!data.storagePath.startsWith(`project/${project.id}/age-id/`)) throw new Error("Invalid file path.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("artist_project_age_verifications")
      .select("id, status, storage_path")
      .eq("project_id", project.id)
      .maybeSingle();
    if (!existing) throw new Error("The studio has not asked for age verification.");
    if (existing.status === "approved") throw new Error("Your age is already verified.");
    if (existing.storage_path && existing.storage_path !== data.storagePath) {
      await supabaseAdmin.storage.from(BUCKET).remove([existing.storage_path]);
    }

    const { data: row, error } = await supabaseAdmin
      .from("artist_project_age_verifications")
      .update({ storage_path: data.storagePath, status: "submitted", submitted_at: new Date().toISOString(), reject_reason: null })
      .eq("id", existing.id)
      .select()
      .single();
    if (error || !row) throw error ?? new Error("Could not submit the ID.");
    await supabaseAdmin.from("artist_client_projects").update({ age_verification_status: "submitted" }).eq("id", project.id);
    await notifyParty(
      project.id,
      project.artist_id,
      context.userId,
      "ID submitted for review",
      "The customer uploaded an ID for age verification.",
      `age-verification-submitted-${row.id}-${row.submitted_at}`,
      true,
    );
    return row;
  });

/** Studio staff opens the ID for a few minutes only. */
export const getAgeVerificationImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const project = await loadProject(data.projectId);
    if (!(await isStudioStaff(context.supabase, project.artist_id, context.userId))) {
      throw new Error("Only the studio can open the ID photo.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("artist_project_age_verifications")
      .select("storage_path, status")
      .eq("project_id", project.id)
      .maybeSingle();
    if (!row?.storage_path || row.status !== "submitted") throw new Error("There is no ID to review.");
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(row.storage_path, 300);
    if (error || !signed) throw error ?? new Error("Could not open the ID photo.");
    return { url: signed.signedUrl };
  });

/** Approve or reject. Either way the photo is deleted right away. */
export const reviewAgeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        birthYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
        reason: z.string().trim().max(280).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const project = await loadProject(data.projectId);
    if (!(await isStudioStaff(context.supabase, project.artist_id, context.userId))) {
      throw new Error("Only the studio can review age verification.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("artist_project_age_verifications")
      .select("id, min_age, storage_path")
      .eq("project_id", project.id)
      .maybeSingle();
    if (!existing) throw new Error("There is nothing to review.");

    if (data.decision === "approved") {
      if (!data.birthYear) throw new Error("Enter the year of birth shown on the ID.");
      const age = new Date().getFullYear() - data.birthYear;
      if (age < existing.min_age) throw new Error(`That ID shows an age under ${existing.min_age}.`);
    }

    if (existing.storage_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([existing.storage_path]);
    }

    const { data: row, error } = await supabaseAdmin
      .from("artist_project_age_verifications")
      .update({
        status: data.decision,
        storage_path: null,
        birth_year: data.decision === "approved" ? (data.birthYear ?? null) : null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        reject_reason: data.decision === "rejected" ? (data.reason ?? null) : null,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error || !row) throw error ?? new Error("Could not save the review.");
    await supabaseAdmin
      .from("artist_client_projects")
      .update({ age_verification_status: data.decision })
      .eq("id", project.id);

    await notifyParty(
      project.id,
      project.client_user_id,
      context.userId,
      data.decision === "approved" ? "Age verified" : "ID not accepted",
      data.decision === "approved"
        ? "The studio verified your age. You can book a time now."
        : data.reason || "The studio could not read your ID. Please upload a new photo.",
      `age-verification-${data.decision}-${row.id}-${row.reviewed_at}`,
      false,
    );
    return row;
  });

/**
 * Shared booking gate. Throws when the studio asked for age verification and
 * it is not approved yet.
 */
export async function assertAgeVerified(projectId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("artist_project_age_verifications")
    .select("status")
    .eq("project_id", projectId)
    .maybeSingle();
  if (data && data.status !== "approved") {
    throw new Error("Age verification required before booking.");
  }
}
