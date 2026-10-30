import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const Body = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Used by Posture Pro to confirm an InkSimulator studio login. Returns only yes/no + studio name.
export const Route = createFileRoute("/api/public/partner/verify-studio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["POSTURE_PRO_BRIDGE_SECRET"];
        const given = request.headers.get("x-partner-secret") ?? "";
        if (!secret || !safeEq(given, secret)) return new Response("Unauthorized", { status: 401 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const client = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client.auth.signInWithPassword(parsed.data);
        if (error || !data.user) return Response.json({ ok: false });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: studio } = await supabaseAdmin
          .from("artist_profiles")
          .select("studio_name, status")
          .eq("user_id", data.user.id)
          .maybeSingle();
        await client.auth.signOut().catch(() => {});

        if (!studio || studio.status !== "approved") return Response.json({ ok: false });
        return Response.json({ ok: true, studioName: studio.studio_name });
      },
    },
  },
});
