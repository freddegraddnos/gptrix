import { publicSiteUrl } from "@/lib/publicOrigin";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Lock, Sparkles, Camera } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { SocialIcon } from "@/components/SocialIcon";
import { platformInfo, type SocialPlatform } from "@/lib/socialAccounts";
import { sortJourney, stepLabel, type JourneyStep } from "@/lib/journeyCollage";
import { ArtistPublicProfile, type PublicArtist } from "@/components/ArtistPublicProfile";


type Item = {
  id: string;
  name: string;
  cover_url: string | null;
  preview_url: string | null;
  tattoo_name: string | null;
  body_part: string | null;
  width_cm: number | null;
  shelf: string;
  collection: string | null;
  created_at: string;
};

type Privacy = "public" | "friends" | "private";

type PublicProfile = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  likes: number;
  socials?: {
    platform: SocialPlatform;
    username: string | null;
    profile_url: string | null;
  }[];
  journeys?: { project_id: string; name: string; steps: JourneyStep[] }[];
  privacy: Record<TabId, Privacy>;

  tattoos: Item[];
  designs: Item[];
  considering: Item[];
  collections: Item[];
};

type TabId = "tattoos" | "designs" | "considering" | "collections";

const TABS: { id: TabId; label: string }[] = [
  { id: "tattoos", label: "Tattoos" },
  { id: "designs", label: "Designs" },
  { id: "considering", label: "Considering" },
  { id: "collections", label: "Collections" },
];

export const Route = createFileRoute("/@{$username}")({
  loader: async ({ params }) => {
    const handle = params.username.replace(/^@/, "");
    const { data, error } = await supabase.rpc("public_profile_page", {
      _handle: handle,
    });
    if (!error && data) {
      return {
        profile: data as unknown as PublicProfile,
        artist: null as PublicArtist | null,
      };
    }
    const { data: artistData } = await supabase.rpc("public_artist_page", {
      _handle: handle,
    });
    if (artistData) {
      return {
        profile: null as PublicProfile | null,
        artist: artistData as unknown as PublicArtist,
      };
    }
    // Studio renamed its address: forward old links to the new one.
    const { data: moved } = await supabase.rpc("resolve_studio_handle", { _handle: handle });
    if (moved) throw redirect({ to: "/$handle", params: { handle: moved }, statusCode: 301 });
    throw notFound();
  },
  head: ({ params, loaderData }) => {
    const handle = params.username.replace(/^@/, "");
    const url = publicSiteUrl(`/@${handle}`);
    if (!loaderData) {
      return {
        meta: [
          { title: "Profile not found — InkSimulator" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    if (loaderData.artist) {
      const a = loaderData.artist;
      const title = `${a.studio_name} (@${handle}) — tattoo artist${a.city ? ` in ${a.city}` : ""} | InkSimulator`;
      const description =
        a.bio?.slice(0, 150) ||
        `${a.studio_name}${a.city ? ` in ${a.city}` : ""} creates tattoo designs with InkSimulator. See before/after examples and book a consultation.`;
      const image =
        a.avatar_url && a.avatar_url.startsWith("https://") ? a.avatar_url : null;
      return {
        meta: [
          { title },
          { name: "description", content: description },
          { property: "og:title", content: title },
          { property: "og:description", content: description },
          { property: "og:type", content: "profile" },
          { property: "og:url", content: url },
          { name: "twitter:card", content: "summary_large_image" },
          ...(image
            ? [
                { property: "og:image", content: image },
                { name: "twitter:image", content: image },
              ]
            : []),
        ],
        links: [{ rel: "canonical", href: url }],
        scripts: [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "TattooParlor",
              name: a.studio_name,
              description,
              url,
              ...(a.city ? { address: { "@type": "PostalAddress", addressLocality: a.city } } : {}),
              ...(image ? { image } : {}),
              ...(a.rating
                ? {
                    aggregateRating: {
                      "@type": "AggregateRating",
                      ratingValue: a.rating,
                      reviewCount: a.review_count ?? 0,
                    },
                  }
                : {}),
            }),
          },
        ],
      };
    }

    const p = loaderData.profile!;
    const name = p.display_name || `@${handle}`;
    const count = p.tattoos.length + p.designs.length + p.considering.length;
    const title = `${name} (@${handle}) — tattoos & AR try-ons | InkSimulator`;
    const description =
      p.bio?.slice(0, 150) ||
      `${name} has ${count} tattoo ideas and AR try-ons on InkSimulator. Try the same design on your own body right in the browser.`;
    const image =
      p.avatar_url && p.avatar_url.startsWith("https://") ? p.avatar_url : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name,
              alternateName: `@${handle}`,
              description,
              url,
              ...(image ? { image } : {}),
            },
          }),
        },
      ],
    };
  },
  notFoundComponent: ProfileMissing,
  component: PublicProfilePage,
});

function ProfileMissing() {
  return (
    <AppShell>
      <div className="py-20 text-center">
        <h1 className="text-xl font-bold">Profile doesn't exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This handle is available — or the profile is private.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-black"
        >
          Try a tattoo on your body
        </Link>
      </div>
    </AppShell>
  );
}

function PublicProfilePage() {
  const data = Route.useLoaderData();
  const [tab, setTab] = useState<TabId>("tattoos");

  if (data.artist) return <ArtistPublicProfile artist={data.artist} />;
  const profile = data.profile!;

  const items = profile[tab] ?? [];
  const privacy = profile.privacy?.[tab] ?? "public";
  const name = profile.display_name || `@${profile.handle}`;

  return (
    <AppShell>
      <header className="mb-6 text-center">
        <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border border-white/15 bg-white/5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`Profile picture for ${name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-accent">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{name}</h1>
        <p className="text-sm text-muted-foreground">@{profile.handle}</p>
        {profile.bio && (
          <p className="mx-auto mt-3 max-w-xs text-sm text-white/80">{profile.bio}</p>
        )}
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs">
          <Heart className="h-3.5 w-3.5 text-accent" />
          {profile.likes} votes on shared try-ons
        </p>

        {profile.socials && profile.socials.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {profile.socials.map((s) => {
              const info = platformInfo(s.platform);
              if (!info) return null;
              const href =
                s.profile_url ?? (s.username ? info.profileUrl(s.username) : null);
              if (!href) return null;
              return (
                <a
                  key={s.platform}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${info.label}: @${s.username ?? ""}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
                  style={{ color: info.color }}
                >
                  <SocialIcon platform={s.platform} className="size-4" />
                </a>
              );
            })}
          </div>
        )}
      </header>

      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${
              tab === t.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-white/10 bg-white/[0.03] text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {privacy !== "public" ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {privacy === "friends"
              ? "This tab is only visible to friends."
              : "This tab is private."}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <article
              key={`${tab}-${item.id}`}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
              <div className="aspect-square bg-black/40">
                {item.cover_url || item.preview_url ? (
                  <img
                    src={(item.cover_url ?? item.preview_url) as string}
                    alt={item.tattoo_name ?? item.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Camera className="h-5 w-5 text-white/30" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h2 className="truncate text-sm font-semibold">
                  {item.tattoo_name ?? item.name}
                </h2>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {[item.body_part, item.width_cm ? `${item.width_cm} cm` : null, item.collection]
                    .filter(Boolean)
                    .join(" · ") || "InkSimulator"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {profile.journeys && profile.journeys.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
            Tattoo Journeys
          </h2>
          <div className="mt-3 space-y-5">
            {profile.journeys
              .filter((j) => j.steps.length > 0)
              .map((j) => {
                const steps = sortJourney(j.steps);
                return (
                  <article
                    key={j.project_id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <h3 className="text-sm font-semibold">{j.name}</h3>
                    <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                      {steps.map((s, i) => (
                        <figure key={s.id} className="w-24 shrink-0">
                          <div className="h-24 w-24 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                            <img
                              src={s.image_url}
                              alt={`${j.name} — ${stepLabel(steps, i)}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <figcaption className="mt-1 text-center text-[10px] font-semibold">
                            {stepLabel(steps, i)}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-accent/30 bg-accent/5 p-5 text-center">

        <Sparkles className="mx-auto h-5 w-5 text-accent" />
        <h2 className="mt-2 text-base font-bold">Try it on your body</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Try the same design in AR on your own skin — free, right in your browser.
        </p>
        <Link
          to="/ar"
          search={{} as never}
          className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-black"
        >
          Start AR try-on
        </Link>
      </section>
    </AppShell>
  );
}
