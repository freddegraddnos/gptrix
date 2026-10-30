import { getPublicOrigin } from "@/lib/publicOrigin";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, machine-readable studio directory for AI assistants and partners.
 * Lists only manually approved InkSimulator studios — never Google Places or
 * scraped data. No personal contact details are returned; booking happens on
 * the studio's booking page at /<handle>/book.
 */
const BASE_URL = getPublicOrigin();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

async function handle(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("artist_profiles")
    .select("user_id,studio_name,handle,city,styles")
    .eq("approval_status", "approved")
    .eq("status", "approved")
    .not("handle", "is", null)
    .not("studio_name", "is", null)
    .order("studio_name", { ascending: true });

  if (error) {
    console.error("[api/public/studios] lookup failed", error);
    return Response.json(
      { error: "Could not load studios" },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  const studios = (rows ?? [])
    .filter((row) => row.handle && row.studio_name)
    .map((row) => ({
      name: row.studio_name,
      handle: row.handle,
      city: row.city ?? null,
      styles: row.styles ?? [],
      profileUrl: `${BASE_URL}/u/${encodeURIComponent(row.handle)}`,
      bookingUrl: `${BASE_URL}/${encodeURIComponent(row.handle)}/book`,
    }));

  return Response.json(
    {
      service: "InkSimulator",
      description:
        "Approved tattoo studios on InkSimulator. Clients try tattoos in AR at 1:1 scale, then send a booking request to the studio from the bookingUrl.",
      count: studios.length,
      studios,
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } },
  );
}

export const Route = createFileRoute("/api/public/studios")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      OPTIONS: ({ request }) => handle(request),
    },
  },
});
