import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDIO_MODULES } from "@/lib/studioModules";

const studio = z.object({ studioId: z.string().uuid() });
const selection = studio.extend({
  enabled: z.array(z.enum(STUDIO_MODULES)).max(STUDIO_MODULES.length),
});
// The generated database types will include this table after the migration is applied.
type ModuleTableClient = {
  from: (table: "studio_module_preferences") => {
    select: (columns: "enabled") => {
      eq: (
        column: "studio_id",
        id: string,
      ) => {
        maybeSingle: () => Promise<{ data: { enabled: string[] } | null; error: Error | null }>;
      };
    };
    upsert: (
      row: { studio_id: string; enabled: string[]; updated_at: string },
      options: { onConflict: "studio_id" },
    ) => Promise<{ error: Error | null }>;
  };
};

export const getStudioModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => studio.parse(value))
  .handler(async ({ data, context }) => {
    const [{ data: admin, error: adminError }, { data: member, error: memberError }] =
      await Promise.all([
        context.supabase.rpc("is_studio_admin", { _studio: data.studioId, _user: context.userId }),
        context.supabase
          .from("studio_members")
          .select("id")
          .eq("studio_id", data.studioId)
          .eq("user_id", context.userId)
          .eq("status", "active")
          .in("role", ["admin", "artist"])
          .limit(1)
          .maybeSingle(),
      ]);
    if (adminError || memberError) throw new Error("Could not check studio access.");
    if (!admin && !member) throw new Error("Only studio team members can view modules.");
    // RLS independently checks studio ownership or active membership.
    const { data: row, error } = await (context.supabase as unknown as ModuleTableClient)
      .from("studio_module_preferences")
      .select("enabled")
      .eq("studio_id", data.studioId)
      .maybeSingle();
    if (error) throw error;
    return row?.enabled ?? null;
  });

export const saveStudioModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => selection.parse(value))
  .handler(async ({ data, context }) => {
    const { data: admin, error: checkError } = await context.supabase.rpc("is_studio_admin", {
      _studio: data.studioId,
      _user: context.userId,
    });
    if (checkError) throw checkError;
    if (!admin) throw new Error("Only studio owners and administrators can change modules.");
    const { error } = await (context.supabase as unknown as ModuleTableClient)
      .from("studio_module_preferences")
      .upsert(
        {
          studio_id: data.studioId,
          enabled: [...new Set(data.enabled)],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id" },
      );
    if (error) throw error;
    return { ok: true };
  });
