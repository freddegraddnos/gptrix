import { publicSiteUrl } from "@/lib/publicOrigin";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArtistPublicProfile, type PublicArtist } from "@/components/ArtistPublicProfile";
import { seo } from "@/lib/seo";
import { resolveThemeMedia } from "@/lib/studioPageMedia";

/** Studio gallery page at inksimulator.com/<handle>. Static routes always win over this. */
export const Route = createFileRoute("/$handle/")({
  loader: async ({ params }) => {
    const handle = params.handle.toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(handle)) throw notFound();
    const { data } = await supabase.rpc("public_artist_page", { _handle: handle });
    if (data) {
      const artist = data as unknown as PublicArtist;
      const media = await resolveThemeMedia(artist.theme, artist.logo_url).catch(() => ({}));
      return { artist, media };
    }
    const { data: moved } = await supabase.rpc("resolve_studio_handle", { _handle: handle });
    if (moved) throw redirect({ to: "/$handle", params: { handle: moved }, statusCode: 301 });
    throw notFound();
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found — InkSimulator" }, { name: "robots", content: "noindex" }] };
    const a = loaderData.artist;
    const url = publicSiteUrl(`/${params.handle}`);
    const description = a.bio?.slice(0, 155) || `${a.studio_name}${a.city ? ` in ${a.city}` : ""}: see the gallery, try designs in AR at 1:1 scale and book your tattoo online.`;
    const avatar = a.avatar_url?.startsWith("https://") ? a.avatar_url : undefined;
    return seo({
      path: `/${params.handle}`,
      title: `${a.studio_name} — Tattoo Studio${a.city ? ` in ${a.city}` : ""} | InkSimulator`,
      description,
      breadcrumb: a.studio_name,
      jsonLd: [{
        "@context": "https://schema.org", "@type": "TattooParlor", name: a.studio_name, description, url,
        ...(a.city ? { address: { "@type": "PostalAddress", addressLocality: a.city } } : {}),
        ...(avatar ? { image: avatar } : {}),
        potentialAction: { "@type": "ReserveAction", target: `${url}/agent` },
      }],
    });
  },
  notFoundComponent: () => <p className="p-8 text-center">Page not found.</p>,
  component: StudioPage,
});

function StudioPage() {
  const { artist, media } = Route.useLoaderData();
  return <ArtistPublicProfile artist={artist} media={media} />;
}
