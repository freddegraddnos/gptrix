import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const draftInput = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).default(""),
  goal: z.enum(["presence", "designs", "booking"]),
});

/** The database derives the account/email and atomically creates only a private draft. */
export const createStudioDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => draftInput.parse(input))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as {
      rpc: (
        fn: "create_studio_draft",
        input: { _name: string; _city: string; _goal: string },
      ) => Promise<{
        data: { id: string; created: boolean } | null;
        error: { message: string } | null;
      }>;
    };
    const result = await client.rpc("create_studio_draft", {
      _name: data.name,
      _city: data.city,
      _goal: data.goal,
    });
    if (result.error || !result.data)
      throw new Error(result.error?.message ?? "Could not create the studio draft.");
    return result.data;
  });
