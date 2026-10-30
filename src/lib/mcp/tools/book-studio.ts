import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "book_studio",
  title: "Send a booking request to a studio",
  description:
    "Send a tattoo booking request from the signed-in user to an approved InkSimulator studio (use the handle from list_studios). The request appears in the studio's panel and the studio and user are notified. The user must have confirmed they are 18+ in their InkSimulator profile.",
  inputSchema: {
    handle: z.string().trim().min(1).describe("Studio handle from list_studios bookingUrl (/<handle>/book)."),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Preferred date, YYYY-MM-DD."),
    preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Preferred time, HH:MM."),
    bodyArea: z.string().trim().max(80).optional(),
    sizeCm: z.number().positive().max(100).optional(),
    note: z.string().trim().max(1000).optional().describe("Description of the tattoo idea."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const userId = ctx.getUserId()!;
    const sb = supabaseForUser(ctx);
    const { data: studio } = await sb
      .from("artist_profiles")
      .select("user_id,studio_name,address,lat,lng")
      .ilike("handle", args.handle)
      .eq("approval_status", "approved")
      .eq("status", "approved")
      .maybeSingle();
    if (!studio) return { content: [{ type: "text", text: "Studio not found or not approved." }], isError: true };
    const { data: row, error } = await sb
      .from("bookings")
      .insert({
        user_id: userId,
        artist_id: studio.user_id,
        studio_name: studio.studio_name,
        studio_address: studio.address ?? null,
        studio_lat: studio.lat ?? null,
        studio_lng: studio.lng ?? null,
        preferred_date: args.preferredDate,
        preferred_time: args.preferredTime ?? null,
        body_area: args.bodyArea ?? null,
        size_cm: args.sizeCm ?? null,
        note: `[Sent via AI assistant] ${args.note ?? ""}`.trim(),
      })
      .select("id,status")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    try {
      const { sendBookingCreatedNotices } = await import("@/lib/bookingNotify.server");
      await sendBookingCreatedNotices(row.id, userId, "agent");
    } catch (e) {
      console.error("[mcp] booking notices failed", e);
    }
    const result = { bookingId: row.id, status: row.status, studio: studio.studio_name };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
