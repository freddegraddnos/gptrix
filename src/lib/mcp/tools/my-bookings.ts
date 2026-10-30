import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_bookings",
  title: "My bookings",
  description: "List the signed-in user's tattoo booking requests and their status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("bookings")
      .select("id,studio_name,status,preferred_date,preferred_time,body_area,size_cm,session_number")
      .eq("user_id", ctx.getUserId()!)
      .order("preferred_date", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const bookings = (data ?? []).map((b) => ({
      id: b.id,
      studio: b.studio_name,
      status: b.status,
      date: b.preferred_date,
      time: b.preferred_time ?? null,
      bodyArea: b.body_area ?? null,
      sizeCm: b.size_cm ?? null,
      session: b.session_number,
    }));
    return { content: [{ type: "text", text: JSON.stringify(bookings) }], structuredContent: { bookings } };
  },
});
