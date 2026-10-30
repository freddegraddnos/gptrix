import { createServerFn } from "@tanstack/react-start";
import { normalizeExternalUrl } from "@/lib/externalUrl";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radius: z.number().min(500).max(50000).default(15000),
});

export type NearbyStudio = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number | null;
  openNow: boolean | null;
  /**
   * Only studios that joined InkSimulator themselves are ever listed.
   * Kept as a field so callers can stay explicit about it.
   */
  source: "partner";
  handle: string | null;
  city: string | null;
  distanceKm: number | null;
};

export type ApprovedStudio = {
  id: string;
  name: string;
  handle: string;
  city: string | null;
  styles: string[];
  avatarUrl: string | null;
};

/** All manually approved InkSimulator studios for the public artist directory. */
export const listApprovedStudios = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApprovedStudio[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("artist_profiles")
      .select("user_id,studio_name,handle,city,styles,avatar_url")
      .eq("approval_status", "approved")
      .eq("status", "approved")
      .not("handle", "is", null)
      .not("studio_name", "is", null)
      .not("address", "is", null)
      .order("studio_name", { ascending: true });

    if (error) {
      console.error("[studios] approved directory lookup failed", error);
      throw new Error("Could not load studios");
    }

    return (rows ?? []).flatMap((row) => {
      if (!row.handle) return [];
      return [{
        id: row.user_id,
        name: row.studio_name ?? row.handle,
        handle: row.handle,
        city: row.city ?? null,
        styles: row.styles ?? [],
        avatarUrl:
          row.avatar_url && /^(https?:|data:)/.test(row.avatar_url)
            ? row.avatar_url
            : null,
      }];
    });
  },
);

/** Great-circle distance in km. */
function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Nearby studios — InkSimulator partner studios only.
 *
 * We deliberately do NOT query Google Places here: the app must never present
 * a business that has not signed up itself.
 */
export const searchNearbyStudios = createServerFn({ method: "POST" })
  .inputValidator((raw) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<NearbyStudio[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("artist_profiles")
      .select(
        "user_id,studio_name,handle,address,city,lat,lng,rating,review_count",
      )
      .eq("approval_status", "approved")
      .eq("status", "approved");
    if (error) {
      console.error("[studios] partner lookup failed", error);
      throw new Error("Could not load studios");
    }

    const radiusKm = data.radius / 1000;
    return (rows ?? [])
      .map((r) => {
        const lat = typeof r.lat === "number" ? r.lat : null;
        const lng = typeof r.lng === "number" ? r.lng : null;
        return {
          id: r.user_id,
          name: r.studio_name ?? "Studio",
          address: r.address ?? r.city ?? "",
          lat: lat ?? 0,
          lng: lng ?? 0,
          rating: r.rating != null ? Number(r.rating) : null,
          userRatingCount: r.review_count ?? null,
          openNow: null,
          source: "partner" as const,
          handle: r.handle ?? null,
          city: r.city ?? null,
          distanceKm:
            lat != null && lng != null
              ? distanceKm(data.lat, data.lng, lat, lng)
              : null,
        };
      })
      // Studios without coordinates still belong in the list; they simply
      // cannot be distance-filtered or pinned on the map.
      .filter((s) => s.distanceKm == null || s.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));
  });

/**
 * Empty-state helper for /studios: the nearest approved studio at any
 * distance, plus the cities that already have a live studio.
 */
export const nearestStudioAnywhere = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("artist_profiles")
      .select("user_id,studio_name,handle,address,city,lat,lng")
      .eq("approval_status", "approved")
      .eq("status", "approved");
    if (error) throw new Error("Could not load studios");
    const all = rows ?? [];
    const cities = Array.from(
      new Set(all.map((r) => (r.city ?? "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    let nearest: { id: string; name: string; handle: string | null; city: string | null; address: string; distanceKm: number } | null = null;
    for (const r of all) {
      if (typeof r.lat !== "number" || typeof r.lng !== "number") continue;
      const d = distanceKm(data.lat, data.lng, r.lat, r.lng);
      if (!nearest || d < nearest.distanceKm) {
        nearest = {
          id: r.user_id,
          name: r.studio_name ?? "Studio",
          handle: r.handle ?? null,
          city: r.city ?? null,
          address: r.address ?? r.city ?? "",
          distanceKm: d,
        };
      }
    }
    return { nearest, cities };
  });



export type StudioDetails = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  rating: number | null;
  userRatingCount: number | null;
  openNow: boolean | null;
  /** Free-text opening hours the studio typed in their own dashboard. */
  hours: string[];
  priceLevel: number | null;
  priceRange: string | null;
  photos: string[];
  instagram: string | null;
  bio: string | null;
  handle: string | null;
  logoUrl: string | null;
  agentEnabled: boolean;
};

/** Full profile for one InkSimulator partner studio. */
export const getStudioDetails = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ placeId: z.string().min(3) }).parse(raw))
  .handler(async ({ data }): Promise<StudioDetails> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("artist_profiles")
      .select(
        "user_id,studio_name,handle,address,city,website,instagram,phone,social_url,bio,rating,review_count,price_level,opening_hours,logo_url",
      )
      .eq("user_id", data.placeId)
      .eq("approval_status", "approved")
      .maybeSingle();
    if (error) {
      console.error("[studios] details failed", error);
      throw new Error("Could not load the studio.");
    }
    if (!row) throw new Error("Studio not found.");

    // Gallery shots the studio uploaded themselves.
    const { data: gallery } = await supabaseAdmin
      .from("studio_gallery")
      .select("image_url")
      .eq("studio_id", data.placeId)
      .limit(6);

    const paths = [row.logo_url, ...(gallery ?? []).map((g) => g.image_url)]
      .filter((p): p is string => !!p);
    const photos: string[] = [];
    for (const p of paths) {
      if (/^https?:|^data:/.test(p)) {
        photos.push(p);
        continue;
      }
      const { data: signed } = await supabaseAdmin.storage
        .from("studio")
        .createSignedUrl(p, 60 * 60 * 24);
      if (signed?.signedUrl) photos.push(signed.signedUrl);
    }

    const { data: agentCfg } = await supabaseAdmin
      .from("studio_agent_settings").select("enabled").eq("studio_id", data.placeId).maybeSingle();
    let logoUrl: string | null = null;
    if (row.logo_url) {
      if (/^https?:|^data:/.test(row.logo_url)) logoUrl = row.logo_url;
      else logoUrl = (await supabaseAdmin.storage.from("studio").createSignedUrl(row.logo_url, 60 * 60 * 24)).data?.signedUrl ?? null;
    }
    const address = row.address ?? row.city ?? "";
    return {
      logoUrl,
      agentEnabled: !!agentCfg?.enabled && !!row.handle,
      id: row.user_id,
      name: row.studio_name ?? "Studio",
      address,
      phone: row.phone ?? null,
      website: normalizeExternalUrl(row.website) ?? normalizeExternalUrl(row.social_url),
      mapsUrl: address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${row.studio_name ?? ""} ${address}`.trim(),
          )}`
        : null,
      rating: row.rating != null ? Number(row.rating) : null,
      userRatingCount: row.review_count ?? null,
      openNow: null,
      hours: (row.opening_hours ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      priceLevel: row.price_level ?? null,
      priceRange: null,
      photos,
      instagram: row.instagram ?? null,
      bio: row.bio ?? null,
      handle: row.handle ?? null,
    };
  });

/**
 * Server-rendered map picture. The browser Maps key is domain-restricted and
 * can be rejected ("Oops! Something went wrong"), so we render the same view
 * through the Static Maps API on the server and hand the page an image.
 */
const staticMapSchema = z.object({
  lat: z.number().min(-85).max(85),
  lng: z.number().min(-180).max(180),
  zoom: z.number().int().min(5).max(17).default(12),
  markers: z
    .array(z.object({ lat: z.number().min(-85).max(85), lng: z.number().min(-180).max(180) }))
    .max(20)
    .default([]),
});

const STATIC_STYLES = [
  "feature:all|element:geometry|color:0x0f1116",
  "feature:all|element:labels.text.stroke|color:0x0f1116",
  "feature:all|element:labels.text.fill|color:0x8a8f98",
  "feature:road|element:geometry|color:0x22262e",
  "feature:water|element:geometry|color:0x0a0a0b",
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
];

export const staticStudioMap = createServerFn({ method: "POST" })
  .inputValidator((raw) => staticMapSchema.parse(raw))
  .handler(async ({ data }): Promise<{ image: string | null }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return { image: null };

    const params = new URLSearchParams();
    params.set("center", `${data.lat},${data.lng}`);
    params.set("zoom", String(data.zoom));
    params.set("size", "640x320");
    params.set("scale", "2");
    params.set("maptype", "roadmap");
    for (const style of STATIC_STYLES) params.append("style", style);
    params.append("markers", `color:0x22D3EE|size:small|${data.lat},${data.lng}`);
    data.markers.slice(0, 20).forEach((m, i) => {
      params.append(
        "markers",
        `color:0xffffff|label:${i + 1 <= 9 ? i + 1 : "S"}|${m.lat},${m.lng}`,
      );
    });

    const res = await fetch(`${GATEWAY_URL}/maps/api/staticmap?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      },
    });
    if (!res.ok) {
      console.error(`[studios] static map ${res.status}: ${await res.text()}`);
      return { image: null };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i += 1) binary += String.fromCharCode(buf[i]!);
    const type = res.headers.get("content-type") ?? "image/png";
    return { image: `data:${type};base64,${btoa(binary)}` };
  });
