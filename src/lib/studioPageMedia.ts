import { supabase } from "@/integrations/supabase/client";
import type { StudioPageTheme } from "@/lib/studioPageTheme";
import type { ThemeMedia } from "@/components/ArtistPublicProfile";

async function sign(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:|^data:/.test(path)) return path;
  const { data } = await supabase.storage.from("studio").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

/** Signed URLs for a studio page's logo, cover, background and custom font. */
export async function resolveThemeMedia(theme: StudioPageTheme | null | undefined, logo: string | null | undefined): Promise<ThemeMedia> {
  const t = theme ?? {};
  const [l, cover, bgImage, fontFile] = await Promise.all([sign(logo), sign(t.cover), sign(t.bg_image), sign(t.font_file)]);
  return { logo: l, cover, bgImage, fontFile };
}
