import { publicSiteUrl } from "@/lib/publicOrigin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAgeVerified } from "@/lib/ageVerification.functions";
import { insertRequestOnce } from "@/lib/requestSubmission";
import { multiRequestId } from "@/lib/multiRequestIdentity";
import type { Database, Json } from "@/integrations/supabase/types";
type ExistingRequestInsert = Database["public"]["Tables"]["artist_client_projects"]["Insert"];
type RequestInsert = ExistingRequestInsert & { source_motif_id?: string; source_motif_snapshot?: Json };

const intakeBase = z.object({
  studioHandle: z.string().min(3).max(40),
  requestKey: z.string().uuid().optional(),
  sourceMotifId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).default(""),
  placement: z.string().trim().max(120).default(""),
  sizeCm: z.number().positive().max(100).nullable().optional(),
  sizeDimension: z.enum(["height", "width", "longest"]).nullable().optional(),
  sizeSource: z.enum(["ar_calibrated", "photo_calibrated", "manual"]).nullable().optional(),
  sizeUnsure: z.boolean().optional(),
  placementUnsure: z.boolean().optional(),
  description: z.string().trim().min(2).max(3000),
  colorMode: z.enum(["color", "black-grey"]),
  sourceProjectId: z.string().uuid().nullable().optional(),
  scanId: z.string().uuid().nullable().optional(),
});
type SizePlacement = { sizeUnsure?: boolean; sizeCm?: number | null; placementUnsure?: boolean; placement: string };
const sizePlacementOk = <T extends z.ZodType<SizePlacement>>(schema: T) => schema.refine((d: SizePlacement) => d.sizeUnsure || (d.sizeCm != null && d.sizeCm > 0), { message: "Enter a size or tick \"I'm not sure\".", path: ["sizeCm"] })
  .refine((d: SizePlacement) => d.placementUnsure || d.placement.length >= 2, { message: "Enter a placement or tick \"I'm not sure\".", path: ["placement"] });
const intakeSchema = sizePlacementOk(intakeBase);

const appointmentSchema = z.object({
  projectId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  durationMinutes: z.number().int().min(15).max(720).default(60),
});

const sketchVersionSchema = z.object({
  projectId: z.string().uuid(),
  storagePath: z.string().min(1).max(1000),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(60 * 1024 * 1024),
  changeComment: z.string().trim().min(2).max(1000),
});

const sketchAnnotationSchema = z.object({
  versionId: z.string().uuid(),
  coordinateKind: z.enum(["image", "model"]),
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite().nullable(),
  body: z.string().trim().min(1).max(1000),
});

async function notifyProjectParty(projectId: string, actorId: string, title: string, body: string, eventKey: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: project } = await supabaseAdmin.from("artist_client_projects").select("artist_id,client_user_id").eq("id", projectId).maybeSingle();
  if (!project) return;
  const recipient = actorId === project.client_user_id ? project.artist_id : project.client_user_id;
  if (!recipient) return;
  const recipientIsStudio = recipient === project.artist_id;
  const url = recipientIsStudio ? `/artists/requests/${projectId}` : `/requests/${projectId}`;
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
      idempotencyKey: eventKey,
    },
  }).catch(() => undefined);
}

export const createSketchVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sketchVersionSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.storagePath.startsWith(`project/${data.projectId}/sketches/`)) throw new Error("Invalid sketch file path.");
    const { data: version, error } = await context.supabase.rpc("create_artist_project_sketch_version", {
      _project_id: data.projectId,
      _storage_path: data.storagePath,
      _file_name: data.fileName,
      _mime_type: data.mimeType,
      _size_bytes: data.sizeBytes,
      _change_comment: data.changeComment,
    });
    if (error || !version) throw error ?? new Error("Could not create sketch version.");
    await notifyProjectParty(data.projectId, context.userId, `Sketch ${version.version_number} uploaded`, data.changeComment, `sketch-version-${version.id}`);
    return version;
  });

export const addSketchAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sketchAnnotationSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.coordinateKind === "image" && (data.x < 0 || data.x > 1 || data.y < 0 || data.y > 1 || data.z !== null)) throw new Error("Invalid image point.");
    if (data.coordinateKind === "model" && data.z === null) throw new Error("Invalid model point.");
    const { data: annotation, error } = await context.supabase.from("artist_project_sketch_annotations").insert({
      version_id: data.versionId,
      author_id: context.userId,
      body: data.body,
      coordinate_kind: data.coordinateKind,
      pos_x: data.x,
      pos_y: data.y,
      pos_z: data.z,
    }).select().single();
    if (error || !annotation) throw error ?? new Error("Could not add comment.");
    const { data: version } = await context.supabase.from("artist_project_sketch_versions").select("project_id,version_number").eq("id", data.versionId).single();
    if (version) await notifyProjectParty(version.project_id, context.userId, `New comment on Sketch ${version.version_number}`, data.body, `sketch-comment-${annotation.id}`);
    return annotation;
  });

export const approveSketchVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ versionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: version, error } = await context.supabase.rpc("approve_artist_project_sketch_version", { _version_id: data.versionId });
    if (error || !version) throw error ?? new Error("Could not approve sketch version.");
    await notifyProjectParty(version.project_id, context.userId, `Sketch ${version.version_number} approved`, "This version is now the project's final design.", `sketch-approved-${version.id}-${version.approved_at}`);
    return version;
  });

export const updateArtistProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    projectId: z.string().uuid(),
    status: z.enum(["open", "sketch_in_progress", "changes_requested", "approved", "booked", "completed", "archived"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase.from("artist_client_projects").select("artist_id").eq("id", data.projectId).maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", { _studio: project.artist_id, _user: context.userId });
    if (!allowed) throw new Error("Only studio team members can change project status.");
    if (data.status === "approved") throw new Error("Approve a specific sketch version instead.");
    const { error } = await context.supabase.from("artist_client_projects").update({ status: data.status }).eq("id", data.projectId);
    if (error) throw error;
    if (data.status === "changes_requested") await notifyProjectParty(data.projectId, context.userId, "Changes requested", "The studio requested changes to the current sketch.", `project-status-${data.projectId}-${Date.now()}`);
    return { ok: true };
  });

type IntakeData = z.infer<typeof intakeBase>;

/** Shared creation logic for a single artist request. */
async function insertArtistRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  data: IntakeData,
  studioHandle: string,
  group: { id: string | null; multi: boolean },
) {
  const { data: publicArtist } = await supabase.rpc("public_artist_page", {
    _handle: studioHandle,
  });
  let artist = publicArtist as unknown as {
    user_id?: string;
    studio_name?: string;
    handle?: string;
  } | null;
  if (!artist?.user_id) {
    // Fallback: the selection may carry the studio's account id, or the
    // studio may not have a public page yet. Look the studio up directly so a
    // customer request never gets lost.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      studioHandle,
    );
    const query = supabaseAdmin.from("artist_profiles").select("user_id, studio_name, handle");
    const { data: row } = isUuid
      ? await query.eq("user_id", studioHandle).maybeSingle()
      : await query.ilike("handle", studioHandle).maybeSingle();
    if (row?.user_id) {
      artist = { user_id: row.user_id, studio_name: row.studio_name ?? undefined, handle: row.handle ?? undefined };
    }
  }
  if (!artist?.user_id) throw new Error("Studio not found.");


  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // A retry uses the same primary key. Never replace the snapshot with later edits.
  if (data.requestKey) {
    const { data: existing, error } = await supabaseAdmin.from("artist_client_projects")
      .select("id,client_user_id,artist_id").eq("id", data.requestKey).maybeSingle();
    if (error) throw error;
    if (existing) {
      if (existing.client_user_id !== userId || existing.artist_id !== artist.user_id)
        throw new Error("This request key belongs to a different request.");
      return { id: existing.id, studioHandle, studioName: artist.studio_name ?? studioHandle };
    }
  }
  let sourceMotif: { id: string; artist_id: string; name: string; usage_terms: string | null; placements: string[]; tattoo_availability?: string | null; tattoo_reuse?: string | null; suggested_size_cm?: number | null; tattoo_price_note?: string | null } | null = null;
  if (data.sourceMotifId) {
    const { data: motif, error } = await supabase.from("marketplace_motifs")
      .select("id,artist_id,name,usage_terms,placements,tattoo_availability,tattoo_reuse,suggested_size_cm,tattoo_price_note").eq("id", data.sourceMotifId).eq("published", true).maybeSingle();
    if (error) throw error;
    if (!motif || motif.artist_id !== artist.user_id)
      throw new Error("This design is not available from the selected studio.");
    sourceMotif = motif;
  }

  let sourceProject: { preview_url: string | null; body_part: string | null; width_cm: number | null; name: string; shared_reference_ids: string[] | null } | null = null;
  let referenceUrls: string[] = [];
  if (data.sourceProjectId) {
    const { data: source } = await supabase
      .from("projects")
      .select("id,preview_url,body_part,width_cm,name,shared_reference_ids")
      .eq("id", data.sourceProjectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!source) throw new Error("The selected design is not available.");
    sourceProject = source;
    const ids = source.shared_reference_ids ?? [];
    if (ids.length) {
      // Only references the customer explicitly ticked on their own idea.
      const { data: refs } = await supabase
        .from("project_assets")
        .select("image_url")
        .in("id", ids)
        .eq("project_id", data.sourceProjectId)
        .eq("user_id", userId);
      referenceUrls = (refs ?? []).map((r: { image_url: string }) => r.image_url).slice(0, 10);
    }
  }
  if (data.scanId) {
    const { data: scan } = await supabase
      .from("body_scans")
      .select("id")
      .eq("id", data.scanId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!scan) throw new Error("The selected scan is not available.");
  }

  const studioUserId = artist.user_id;
  const requestId = data.requestKey ?? crypto.randomUUID();
  const { row: project, created } = await insertRequestOnce(
    requestId, userId, studioUserId,
    async () => {
      const { data: row, error } = await supabaseAdmin.from("artist_client_projects")
        .select("id,client_user_id,artist_id").eq("id", requestId).maybeSingle();
      if (error) throw error;
      return row;
    },
    async () => {
      const payload: RequestInsert = {
      id: requestId,
      artist_id: studioUserId,
      client_user_id: userId,
      client_name: data.name,
      client_email: data.email,
      client_phone: data.phone,
      title: sourceMotif?.name || sourceProject?.name || (data.placement ? `${data.placement} tattoo request` : "Tattoo enquiry"),
      ...(sourceMotif ? { source_motif_id: sourceMotif.id, source_motif_snapshot: sourceMotif } : {}),
      placement: data.placement || (data.placementUnsure ? null : sourceProject?.body_part) || null,
      size_cm: data.sizeCm ?? null,
      size_dimension: data.sizeDimension ?? null,
      size_source: data.sizeSource ?? null,
      size_unsure: !!data.sizeUnsure,
      placement_unsure: !!data.placementUnsure,
      reference_urls: referenceUrls,
      description: sourceMotif ? `${data.description}\n\n${sourceMotif.name} · ${publicSiteUrl(`/shop/${sourceMotif.id}`)}` : data.description,
      color_mode: data.colorMode,
      source_project_id: data.sourceProjectId ?? null,
      scan_id: data.scanId ?? null,
      base_photo_url: sourceProject?.preview_url ?? null,
      acquisition_source: "inkvision",
      status: "open",
      request_group_id: group.id,
      sent_to_multiple: group.multi,
    };
      // Additive 0058 fields are typed above until the deployed Supabase schema is regenerated.
      const existingShape: ExistingRequestInsert = payload;
      const { data: row, error } = await supabaseAdmin.from("artist_client_projects").insert(existingShape)
    .select("id,client_user_id,artist_id")
    .single();
      return { row, error };
    },
  );
  if (!created) return { id: project.id, studioHandle, studioName: artist.studio_name ?? studioHandle };

  // Artists are told the client is comparing a few artists — never which ones.
  const requestLink = publicSiteUrl(`/artists/requests/${project.id}`);
  const { notifyUser } = await import("@/lib/notify.server");
  await notifyUser(artist.user_id, {
    kind: "message",
    title: "New tattoo request",
    body: `${data.name} · ${data.placement || "placement unsure"} · ${data.sizeCm != null ? `${data.sizeCm} cm` : "size unsure"}`,
    url: `/artists/requests/${project.id}`,
    inApp: { kind: "message", actorId: userId },
  }).catch(() => undefined);

  // Every request also goes by email to the address the studio chose in its
  // profile, independent of personal notification preferences.

  await (async () => {
    const { data: studio } = await supabaseAdmin
      .from("artist_profiles")
      .select("contact_email, notify_email, studio_name, notify_phone, notify_email_enabled, notify_sms_enabled")
      .eq("user_id", studioUserId)
      .maybeSingle();
    let smsOk = false;
    if (studio?.notify_sms_enabled && studio.notify_phone) {
      const { sendSms } = await import("@/lib/sms.server");
      const r = await sendSms(
        studio.notify_phone,
        `Ny förfrågan från ${data.name} – ${data.placement}. Öppna: ${requestLink}`,
      );
      smsOk = r.ok;
    }
    // Email when enabled, or as a fallback whenever SMS did not go through.
    if (studio && studio.notify_email_enabled === false && smsOk) return;
    let to = studio?.notify_email?.trim() || studio?.contact_email?.trim() || null;
    if (!to) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(studioUserId);
      to = authUser?.user?.email ?? null;
    }
    if (!to) return;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const templateData = {
      studioName: studio?.studio_name ?? artist.studio_name ?? "your studio",
      clientName: data.name,
      clientEmail: data.email,
      clientPhone: data.phone,
      placement: data.placement,
      sizeCm: data.sizeCm != null ? String(data.sizeCm) : "",
      colorMode: data.colorMode,
      description: data.description,
      comparing: group.multi,
      link: requestLink,
    };
    await sendTemplateEmail("studio-request", to, {
      templateData,
      idempotencyKey: `artist-request-${project.id}`,
      replyTo: data.email || undefined,
    });
    // Statistics copy to the InkSimulator admin inbox.
    const { sendAdminRequestCopy } = await import("@/lib/adminCopy.server");
    await sendAdminRequestCopy("studio-request", templateData, `artist-request-${project.id}`);
  })().catch((cause) => console.error("[requests] studio email failed", cause));

  return { id: project.id as string, studioHandle, studioName: artist.studio_name ?? studioHandle };
}

/** Studio accounts (owners and active team members) may not send customer requests. */
async function assertCustomerAccount(sb: { rpc: (fn: "is_any_studio_account", args: { _user: string }) => PromiseLike<{ data: boolean | null; error: unknown }> }, userId: string) {
  const { data, error } = await sb.rpc("is_any_studio_account", { _user: userId });
  if (error) throw new Error("Could not verify account type.");
  if (data) throw new Error("Studio accounts cannot send customer requests to studios.");
}

export const createArtistRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => intakeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCustomerAccount(context.supabase, context.userId);
    const { data: adult } = await context.supabase.rpc("booking_adult_declared", { _user: context.userId });
    if (!adult) throw new Error("Confirm you are 18 or older before sending a request.");
    const created = await insertArtistRequest(context.supabase, context.userId, data, data.studioHandle, { id: null, multi: false });
    return { id: created.id };
  });

const multiIntakeSchema = sizePlacementOk(intakeBase
  .omit({ studioHandle: true, sourceMotifId: true })
  .extend({ studioHandles: z.array(z.string().min(3).max(40)).min(1).max(5) }));

export const createArtistRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => multiIntakeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCustomerAccount(context.supabase, context.userId);
    const { data: adult } = await context.supabase.rpc("booking_adult_declared", { _user: context.userId });
    if (!adult) throw new Error("Confirm you are 18 or older before sending a request.");
    const handles = Array.from(new Set(data.studioHandles.map((h) => h.toLowerCase())));
    const multi = handles.length > 1;
    const requestKey = data.requestKey ?? crypto.randomUUID();
    const groupId = multi ? await multiRequestId(requestKey, `${context.userId}:group`) : null;
    const created: { id: string; studioHandle: string; studioName: string }[] = [];
    for (const handle of handles) {
      const row = await insertArtistRequest(
        context.supabase,
        context.userId,
        { ...data, studioHandle: handle, requestKey: await multiRequestId(requestKey, `${context.userId}:studio:${handle}`) },
        handle,
        { id: groupId, multi },
      );
      created.push(row);
    }
    return { projects: created };
  });



export const confirmArtistProjectAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => appointmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id,artist_id,client_user_id,placement,size_cm")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project?.client_user_id) throw new Error("This request has no linked customer account.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
      _studio: project.artist_id,
      _user: context.userId,
    });
    if (!allowed) throw new Error("You do not have access to confirm this appointment.");
    await assertAgeVerified(project.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: studio } = await supabaseAdmin
      .from("artist_profiles")
      .select("studio_name,address,require_deposit_for_confirmation")
      .eq("user_id", project.artist_id)
      .maybeSingle();

    // Studios can require a paid deposit before a time counts as confirmed.
    const { data: deposit } = await supabaseAdmin
      .from("project_deposits")
      .select("status")
      .eq("project_id", project.id)
      .neq("status", "cancelled")
      .maybeSingle();
    const awaitingDeposit = Boolean(
      studio?.require_deposit_for_confirmation && deposit?.status !== "paid",
    );

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: project.client_user_id,
        artist_id: project.artist_id,
        artist_project_id: project.id,
        studio_name: studio?.studio_name ?? "Tattoo studio",
        studio_address: studio?.address ?? null,
        preferred_date: data.date,
        preferred_time: data.time,
        duration_minutes: data.durationMinutes,
        body_area: project.placement,
        size_cm: project.size_cm,
        status: awaitingDeposit ? "awaiting_deposit" : "confirmed",
      })
      .select("id")
      .single();
    if (error || !booking) throw error ?? new Error("Could not confirm appointment.");

    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(project.client_user_id, {
      kind: "confirmation",
      title: awaitingDeposit ? "Time held — deposit needed" : "Appointment confirmed",
      body: `${studio?.studio_name ?? "Your studio"} · ${data.date}${data.time ? ` ${data.time}` : ""}${awaitingDeposit ? " · pay the deposit to confirm" : ""}`,
      url: `/requests/${project.id}`,
      inApp: { kind: "booking", actorId: context.userId },
      email: {
        template: "booking-status",
        templateData: {
          studioName: studio?.studio_name ?? "Your studio",
          status: awaitingDeposit ? "awaiting deposit" : "confirmed",
          date: data.date,
          time: data.time ?? "",
          link: publicSiteUrl(`/requests/${project.id}`),
        },
        idempotencyKey: `project-booking-confirmed-${booking.id}`,
      },
    }).catch(() => undefined);
    return { id: booking.id, awaitingDeposit };
  });

export const notifyArtistProjectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), messageId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project } = await supabase
      .from("artist_client_projects")
      .select("id, artist_id, client_user_id, client_name")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) return { sent: false };
    const { data: message } = await supabase
      .from("artist_project_messages")
      .select("body, sender_id")
      .eq("id", data.messageId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (!message || message.sender_id !== userId) return { sent: false };

    const recipient = userId === project.client_user_id ? project.artist_id : project.client_user_id;
    if (!recipient) return { sent: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sender } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const senderName = sender?.display_name ?? project.client_name ?? "InkSimulator";
    const { notifyUser } = await import("@/lib/notify.server");
    const recipientIsStudio = recipient === project.artist_id;
    const projectUrl = recipientIsStudio
      ? `/artists/requests/${project.id}`
      : `/requests/${project.id}`;
    const result = await notifyUser(recipient, {
      kind: "message",
      title: `New project message from ${senderName}`,
      body: message.body.slice(0, 140) || "Sent an attachment",
      url: projectUrl,
      inApp: { kind: "message", actorId: userId },
      email: {
        template: "new-message",
        templateData: {
          senderName,
          preview: message.body.slice(0, 200) || "Sent an attachment",
          link: publicSiteUrl(`${projectUrl}`),
        },
        idempotencyKey: `project-message-${data.messageId}`,
      },
    });
    return { sent: result.emails > 0 || result.push > 0 };
  });