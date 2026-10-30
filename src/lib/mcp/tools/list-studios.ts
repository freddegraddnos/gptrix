import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const BASE = "https://www.inksimulator.com";

export default defineTool({
  name: "list_studios",
  title: "List approved studios",
  description: "List approved InkSimulator tattoo studios, optionally filtered by city, with booking links.",
  inputSchema: { city: z.string().trim().optional().describe("Optional city to filter by.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("artist_profiles")
      .select("studio_name,handle,city,styles")
      .eq("approval_status", "approved")
      .eq("status", "approved")
      .not("handle", "is", null)
      .order("studio_name");
    if (city) q = q.ilike("city", `%${city}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const studios = (data ?? []).map((r) => ({
      name: r.studio_name ?? "",
      city: r.city ?? null,
      styles: (r.styles ?? []) as string[],
      bookingUrl: `${BASE}/${encodeURIComponent(r.handle ?? "")}/book`,
    }));
    return { content: [{ type: "text", text: JSON.stringify(studios) }], structuredContent: { studios } };
  },
});
