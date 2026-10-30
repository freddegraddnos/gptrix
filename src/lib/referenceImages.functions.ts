import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { storagePathFromSignedUrl } from "@/lib/storageUrl";

/**
 * Re-signs a request's reference images every time the case is opened, so a
 * saved reference never stops working. Only the customer and the studio of
 * that request get links; the stored files stay private.
 */
export const freshReferenceUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: party } = await context.supabase.rpc("is_artist_project_party", {
      _project: data.projectId,
      _user: context.userId,
    });
    if (!party) throw new Error("Not allowed.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project } = await supabaseAdmin
      .from("artist_client_projects")
      .select("reference_urls")
      .eq("id", data.projectId)
      .maybeSingle();
    const urls = (project?.reference_urls ?? []) as string[];
    const out: string[] = [];
    for (const url of urls) {
      const loc = storagePathFromSignedUrl(url);
      if (!loc) { out.push(url); continue; }
      const { data: signed } = await supabaseAdmin.storage.from(loc.bucket).createSignedUrl(loc.path, 60 * 60 * 6);
      out.push(signed?.signedUrl ?? url);
    }
    return { urls: out };
  });
