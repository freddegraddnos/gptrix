import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getPublicOrigin } from "@/lib/publicOrigin";

interface SitemapEntry {
  path: string;
  changefreq?: "weekly" | "monthly" | "daily";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const BASE_URL = getPublicOrigin();
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/photo-tryon", changefreq: "weekly", priority: "0.9" },
          { path: "/for-studios", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/for-studios", changefreq: "monthly", priority: "0.8" },
          { path: "/studio-guide", changefreq: "monthly", priority: "0.6" },
          { path: "/sv/studio-guide", changefreq: "monthly", priority: "0.6" },
          { path: "/studio-guide/setup", changefreq: "monthly", priority: "0.5" },
          { path: "/sv/studio-guide/setup", changefreq: "monthly", priority: "0.5" },
          { path: "/for-studios.md", changefreq: "monthly", priority: "0.6" },
          { path: "/llms.txt", changefreq: "monthly", priority: "0.5" },
          { path: "/pricing", changefreq: "monthly", priority: "0.8" },
          { path: "/about", changefreq: "monthly", priority: "0.7" },
          { path: "/discover", changefreq: "weekly", priority: "0.8" },
          { path: "/create", changefreq: "monthly", priority: "0.7" },
          { path: "/artists", changefreq: "monthly", priority: "0.6" },
          { path: "/library", changefreq: "daily", priority: "0.9" },
          { path: "/shop", changefreq: "weekly", priority: "0.8" },
          { path: "/try-it-on", changefreq: "monthly", priority: "0.7" },
          { path: "/ar", changefreq: "weekly", priority: "0.9" },
          { path: "/calibrate", changefreq: "monthly", priority: "0.7" },
          { path: "/advisor", changefreq: "monthly", priority: "0.7" },
          { path: "/generator", changefreq: "weekly", priority: "0.8" },
          { path: "/tattoo-font-generator", changefreq: "monthly", priority: "0.9" },
          { path: "/community", changefreq: "daily", priority: "0.8" },
          { path: "/studios", changefreq: "weekly", priority: "0.7" },
          { path: "/sleeve-builder", changefreq: "monthly", priority: "0.7" },
          { path: "/guides/placement-guide", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/prova-tatuering", changefreq: "monthly", priority: "0.9" },
          { path: "/sv/tatuering-text", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/texttatuering-ai-ar", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/ai-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/skapa-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/skapa-tatueringsmotiv", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/cover-up-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/prova-tatueringsmotiv", changefreq: "monthly", priority: "0.9" },
          { path: "/sv/romerska-siffror-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/fineline-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/realistisk-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/djur-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/tatueringsmotiv", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/sma-tatueringar", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-blommor", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-fjaril", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-hjarta", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-kompass", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-fagel", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-stjarna", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-orm", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-ros", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-varg", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/japansk-tatuering", changefreq: "monthly", priority: "0.7" },
          { path: "/sv/tatuering-placering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/pris-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/boka-tatuering", changefreq: "monthly", priority: "0.8" },
          { path: "/sv/tatuerare-stockholm", changefreq: "weekly", priority: "0.8" },
          { path: "/sv/tatuerare-goteborg", changefreq: "weekly", priority: "0.8" },
          { path: "/sv/tatuerare-malmo", changefreq: "weekly", priority: "0.8" },
          { path: "/sv/tatuerare-linkoping", changefreq: "weekly", priority: "0.8" },
          { path: "/sv/tatuerare-helsingborg", changefreq: "weekly", priority: "0.8" },
          { path: "/reveal", changefreq: "monthly", priority: "0.8" },
          { path: "/before-after", changefreq: "monthly", priority: "0.7" },
          { path: "/privacy", changefreq: "monthly", priority: "0.3" },
          { path: "/terms", changefreq: "monthly", priority: "0.3" },
        ];

        // Include public profile pages without silently truncating a large directory.
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) throw new Error("Public profile sitemap credentials are unavailable");
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await client
            .from("public_profiles")
            .select("handle")
            .not("handle", "is", null)
            .order("handle")
            .range(offset, offset + pageSize - 1);
          if (error) throw new Error(`Could not list public profiles for sitemap: ${error.message}`);
          for (const row of data ?? []) {
            if (row.handle) {
              entries.push({ path: `/@${encodeURIComponent(row.handle)}`, changefreq: "weekly", priority: "0.6" });
            }
          }
          if (!data || data.length < pageSize) break;
        }

        // Approved studio pages at inksimulator.com/<handle> (public data only: handle).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: studios } = await supabaseAdmin
          .from("artist_profiles")
          .select("handle")
          .eq("status", "approved")
          .eq("approval_status", "approved")
          .not("handle", "is", null);
        for (const st of studios ?? []) {
          if (st.handle) {
            entries.push({ path: `/${encodeURIComponent(st.handle)}`, changefreq: "weekly", priority: "0.7" });
            entries.push({ path: `/${encodeURIComponent(st.handle)}/agent`, changefreq: "weekly", priority: "0.5" });
          }
        }

        const urls = entries
          .map(
            (e) =>
              `  <url><loc>${BASE_URL}${e.path}</loc>${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority ? `<priority>${e.priority}</priority>` : ""}</url>`,
          )
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
