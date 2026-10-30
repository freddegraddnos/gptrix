import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StudioRequestAccess = "allowed" | "missing" | "forbidden";

/**
 * Resolves access without returning any request or customer data.
 * The normal user-scoped client checks access first; the privileged lookup is
 * only used to tell a missing opaque UUID from an existing inaccessible one.
 */
export const getStudioRequestAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ status: StudioRequestAccess }> => {
    const [{ data: ownedStudio }, { data: membership }] = await Promise.all([
      context.supabase
        .from("artist_profiles")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("studio_members")
        .select("studio_id")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .in("role", ["admin", "artist"])
        .limit(1)
        .maybeSingle(),
    ]);
    if (!ownedStudio && !membership) return { status: "forbidden" };

    const { data: accessible, error: accessibleError } = await context.supabase
      .from("artist_client_projects")
      .select("id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (accessibleError) throw new Error("Could not check request access.");
    if (accessible) return { status: "allowed" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("artist_client_projects")
      .select("id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (existingError) throw new Error("Could not check request access.");
    return { status: existing ? "forbidden" : "missing" };
  });