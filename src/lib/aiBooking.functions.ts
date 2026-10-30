import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TimeSuggestion } from "@/lib/aiTime.server";

const schema = z.object({
  source: z.enum(["instagram", "project"]),
  messageId: z.string().uuid(),
});

/**
 * Looks for an appointment time in one chat message. The result is cached on
 * the message row so every thread is analysed once. Nothing is ever booked
 * here — the studio confirms from the suggestion card.
 */
export const suggestTimeFromMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const table = data.source === "instagram" ? "instagram_messages" : "artist_project_messages";
    const { data: row } = await context.supabase
      .from(table)
      .select("id, body, ai_time, ai_checked_at")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!row) throw new Error("Message not found.");
    if (row.ai_checked_at) return (row.ai_time ?? { found: false }) as TimeSuggestion;

    const { extractTimeFromText } = await import("@/lib/aiTime.server");
    const suggestion = await extractTimeFromText(row.body ?? "");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from(table)
      .update({ ai_time: JSON.parse(JSON.stringify(suggestion)), ai_checked_at: new Date().toISOString() })
      .eq("id", row.id);
    return suggestion;
  });
