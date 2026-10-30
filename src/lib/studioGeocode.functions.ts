import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sets the signed-in studio's map position from its own saved address via
 * OpenStreetMap Nominatim. Only an unambiguous street-number match is stored;
 * otherwise the position is left empty (never guessed).
 */
export const geocodeMyStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ profileId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<{ ok: boolean; lat?: number; lng?: number }> => {
    const { data: row } = await context.supabase
      .from("artist_profiles")
      .select("id,user_id,address,city")
      .eq("id", data.profileId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.address) return { ok: false };

    const postcode = row.city?.match(/\d{3}\s?\d{2}/)?.[0]?.replace(/\s/g, "");
    const town = row.city?.replace(/\d{3}\s?\d{2}/, "").trim();
    const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "2", countrycodes: "se" });
    params.set("street", row.address);
    if (postcode) params.set("postalcode", postcode);
    if (town) params.set("city", town);

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "InkSimulator studio geocoding (https://www.inksimulator.com)" },
    });
    if (!res.ok) {
      console.error(`[geocode] ${res.status}: ${await res.text()}`);
      return { ok: false };
    }
    const hits = (await res.json()) as Array<{ lat: string; lon: string; address?: { house_number?: string } }>;
    if (hits.length !== 1 || !hits[0]!.address?.house_number) return { ok: false };
    const lat = Number(hits[0]!.lat);
    const lng = Number(hits[0]!.lon);
    const { error } = await context.supabase.from("artist_profiles").update({ lat, lng }).eq("id", row.id);
    if (error) return { ok: false };
    return { ok: true, lat, lng };
  });
