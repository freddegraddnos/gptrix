import { IdentityPending } from "@/components/IdentityPending";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { studioImageUrls } from "@/lib/studioMedia";
import { normalizeExternalUrl } from "@/lib/externalUrl";
import { useStudioAccount } from "@/hooks/useStudioAccount";
import { StudioAccountNotice } from "@/components/StudioAccountNotice";
import { tx, useUiLang } from "@/lib/uiLang";
import { Link } from "@tanstack/react-router";
import { Instagram, Globe, MapPin, Star, Sparkles, MessageCircle, Bot } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { StudioPublicSections } from "@/components/StudioPublicSections";
import { fontFor, googleFontHref, resolveSections, themeColors, type StudioPageTheme } from "@/lib/studioPageTheme";

export type PublicArtist = {
  user_id: string;
  handle: string;
  studio_name: string;
  city: string | null;
  address: string | null;
  bio: string | null;
  website: string | null;
  instagram: string | null;
  avatar_url: string | null;
  logo_url?: string | null;
  theme?: StudioPageTheme | null;
  agent_enabled?: boolean;
  styles: string[] | null;
  price_level: number | null;
  rating: number | null;
  review_count: number | null;
  accepts_messages: boolean;
  verified?: boolean | null;
  design_count: number;
  showcase: { id: string; title: string; before_url: string | null; after_url: string | null }[];
};

/** Signed/absolute URLs for the theme's stored files. */
export type ThemeMedia = { logo?: string | null; cover?: string | null; bgImage?: string | null; fontFile?: string | null };

export function ArtistPublicProfile({ artist, media }: { artist: PublicArtist; media?: ThemeMedia }) {
  return (
    <AppShell>
      <ThemedStudioPage artist={artist} media={media ?? {}} />
    </AppShell>
  );
}

/** Also used as the live preview in the studio panel. */
export function ThemedStudioPage({ artist, media, preview = false }: { artist: PublicArtist; media: ThemeMedia; preview?: boolean }) {
  useUiLang();
  const theme = artist.theme ?? {};
  const c = themeColors(theme);
  const font = fontFor(theme);
  const gf = googleFontHref(theme);
  const layout = theme.layout ?? "about";
  const compact = layout === "compact";
  const imageBg = theme.bg === "image" && media.bgImage;
  const style = {
    "--sp-bg": c.bg, "--sp-fg": c.fg, "--sp-accent": c.accent, "--sp-on-accent": c.onAccent,
    backgroundColor: c.bg, color: c.fg,
    backgroundImage: imageBg ? `linear-gradient(rgba(0,0,0,.72), rgba(0,0,0,.72)), url("${media.bgImage}")` : undefined,
    backgroundSize: "cover", backgroundPosition: "center",
  } as CSSProperties;
  const heading: CSSProperties = { fontFamily: `"${font.family}", var(--font-display)` };
  const muted = { color: c.fg, opacity: 0.7 };
  const chip = "rounded-full border px-3 py-1";
  const border = { borderColor: `color-mix(in srgb, ${c.fg} 18%, transparent)` };
  // Invalid stored websites stay hidden until the studio corrects them.
  const websiteHref = normalizeExternalUrl(artist.website);
  const studioAcct = useStudioAccount();
  useUiLang();
  const logo = media.logo ?? artist.avatar_url;
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});
  const imgKey = (theme.pages ?? []).flatMap((p) => p.images ?? []).join("|");
  useEffect(() => {
    if (!imgKey) return;
    void studioImageUrls(imgKey.split("|")).then(setPageUrls);
  }, [imgKey]);

  const header = (
    <header className={compact ? "flex items-center gap-4 text-left" : "text-center"}>
      <div className={`${compact ? "h-16 w-16" : "mx-auto h-24 w-24"} shrink-0 overflow-hidden rounded-full border`} style={{ ...border, background: c.bg, marginTop: media.cover && !compact ? "-3rem" : undefined, position: "relative" }}>
        {logo ? <img src={logo} alt={`${artist.studio_name} logo`} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ color: c.accent }}>{artist.studio_name.slice(0, 1).toUpperCase()}</div>}
      </div>
      <div className="min-w-0">
        {!compact && <p className="mt-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: c.accent }}>{tx("Tattoo studio")}</p>}
        <h1 className={`${compact ? "text-2xl" : "mt-1 text-3xl"} leading-tight`} style={heading}>{artist.studio_name}</h1>
        {artist.verified && <div className={`mt-1 flex ${compact ? "" : "justify-center"}`}><VerifiedBadge verified size="md" /></div>}
        {(artist.city || artist.address) && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs" style={muted}>
            <MapPin className="h-3.5 w-3.5" />{[artist.city, artist.address].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </header>
  );

  const about = (
    <section className={compact ? "mt-4" : "mt-5 text-center"}>
      {artist.bio && <p className={`${compact ? "" : "mx-auto max-w-sm"} text-sm`} style={{ opacity: 0.85 }}>{artist.bio}</p>}
      <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs ${compact ? "" : "justify-center"}`}>
        {artist.rating != null && (
          <span className={`${chip} inline-flex items-center gap-1`} style={border}>
            <Star className="h-3.5 w-3.5" style={{ color: c.accent }} />{artist.rating.toFixed(1)}{artist.review_count ? ` (${artist.review_count})` : ""}
          </span>
        )}
        {artist.price_level != null && <span className={chip} style={border}>{"$".repeat(Math.max(1, Math.min(4, artist.price_level)))}</span>}
      </div>
      {artist.styles && artist.styles.length > 0 && (
        <div className={`mt-3 flex flex-wrap gap-1.5 ${compact ? "" : "justify-center"}`}>
          {artist.styles.map((s) => <span key={s} className={`${chip} text-[11px]`} style={{ borderColor: c.accent, color: c.accent }}>{s}</span>)}
        </div>
      )}
      <div className={`mt-4 flex items-center gap-2 ${compact ? "" : "justify-center"}`}>
        {artist.instagram && (
          <a href={`https://instagram.com/${artist.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" aria-label={tx("Instagram")} className="flex h-9 w-9 items-center justify-center rounded-full border" style={border}><Instagram className="size-4" /></a>
        )}
        {websiteHref && (
          <a href={websiteHref} target="_blank" rel="noopener noreferrer" aria-label={tx("Website")} className="flex h-9 w-9 items-center justify-center rounded-full border" style={border}><Globe className="size-4" /></a>
        )}
      </div>
    </section>
  );

  const gallery = artist.showcase.length === 0 ? null : (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: c.accent }}>{tx("Our work")}</h2>
      {compact ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {artist.showcase.map((s) => s.after_url && <img key={s.id} src={s.after_url} alt={s.title} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />)}
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {artist.showcase.map((s) => (
            <article key={s.id} className="rounded-2xl border p-3" style={border}>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[["BEFORE", s.before_url], ["AFTER", s.after_url]].map(([label, src]) => src && (
                  <figure key={label}>
                    <img src={src} alt={`${s.title} ${label?.toLowerCase()}`} loading="lazy" className="rounded-xl" />
                    <figcaption className="mt-1 text-center text-[10px]" style={muted}>{label}</figcaption>
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold";
  const cta = (
    <section className="mt-8 rounded-2xl border p-5 text-center" style={{ borderColor: c.accent }}>
      <Sparkles className="mx-auto h-5 w-5" style={{ color: c.accent }} />
      <h2 className="mt-2 text-lg" style={heading}>{tx("Book a consultation")}</h2>
      <p className="mt-1 text-sm" style={muted}>{tx("Send a request to")}{" "}{artist.studio_name}{" "}{tx("with your design, placement, and size.")}</p>
      <p className="mt-1 text-xs" style={muted}>{tx("The studio reviews your idea and replies with a time suggestion or questions.")}</p>
      {!preview && (
        <div className="mt-4 flex flex-col gap-2">
          {artist.agent_enabled && (
            <Link to="/$handle/agent" params={{ handle: artist.handle }} className={btn} style={{ background: c.accent, color: c.onAccent }}>
              <Bot className="size-4" />{" "}{tx("Chat with my booking agent")}
            </Link>
          )}
          {studioAcct.loading ? (
            <IdentityPending />
          ) : studioAcct.isStudio ? (
            <StudioAccountNotice studioName={studioAcct.studioName} />
          ) : (
            <>
              <Link to="/$handle/book" params={{ handle: artist.handle }} className={btn} style={artist.agent_enabled ? { border: `1px solid ${c.accent}` } : { background: c.accent, color: c.onAccent }}>
                <Sparkles className="size-4" />{" "}{tx("Send my idea")}
              </Link>
              {resolveSections(theme).some((section) => section.key === "services" && !section.hidden) && (
                <a href={`/${encodeURIComponent(artist.handle)}#available-times`} className={`${btn} border`} style={border}>
                  {tx("Available times")}
                </a>
              )}
              <Link to="/messages" search={{ to: artist.user_id }} className={`${btn} border`} style={border}>
                <MessageCircle className="size-4" />{" "}{tx("Contact the studio")}
              </Link>
            </>
          )}
        </div>
      )}
      {preview && artist.agent_enabled && <span className={`${btn} mt-4 w-full`} style={{ background: c.accent, color: c.onAccent }}><Bot className="size-4" />{" "}{tx("Chat with my booking agent")}</span>}
      {preview && (
        <p role="note" className="mt-4 rounded-lg border border-dashed px-3 py-2 font-mono text-[11px]" style={border}>
          {tx("Preview — requests and bookings cannot be sent from here.")}
        </p>
      )}
    </section>
  );

  const sections = preview ? null : (
    <StudioPublicSections studioId={artist.user_id} openingHours={(artist as unknown as { opening_hours?: string | null }).opening_hours ?? null} />
  );

  const pages = (theme.pages ?? []).filter((p) => p.title.trim());
  const intro = theme.intro?.trim() ? (
    <section className="mt-6 whitespace-pre-line text-sm" style={{ opacity: 0.9 }}>{theme.intro}</section>
  ) : null;
  const pageButtons = pages.length ? (
    <nav aria-label={tx("Studio pages")} className={`mt-6 flex flex-wrap gap-2 ${compact ? "" : "justify-center"}`}>
      {pages.map((p) => p.url && !p.text && !p.images?.length ? (
        <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className={`${chip} inline-flex items-center gap-1 text-sm`} style={{ borderColor: c.accent, color: c.accent }}>{p.title}<ExternalLink className="size-3" /></a>
      ) : (
        <button key={p.id} type="button" onClick={() => setOpenPage(p.id)} className={`${chip} text-sm`} style={{ borderColor: c.accent, color: c.accent }}>{p.title}</button>
      ))}
    </nav>
  ) : null;
  const current = pages.find((p) => p.id === openPage);
  const mobileCoverPosition = theme.cover_position_mobile === "top" ? "object-top" : theme.cover_position_mobile === "bottom" ? "object-bottom" : "object-center";
  const desktopCoverPosition = theme.cover_position_desktop === "top" ? "sm:object-top" : theme.cover_position_desktop === "bottom" ? "sm:object-bottom" : "sm:object-center";

  const nodes: Record<string, ReactNode> = { about, gallery, services: sections, cta };
  const order: ReactNode[] = resolveSections(theme).filter((x) => !x.hidden).map((x) => nodes[x.key]);

  return (
    <div className="studio-page -mx-4 overflow-hidden rounded-2xl px-4 pb-8" style={style}>
      {gf && <link rel="stylesheet" href={gf} />}
      {theme.font === "custom" && media.fontFile && (
        <style>{`@font-face{font-family:"StudioCustomFont";src:url("${media.fontFile.replace(/"/g, "")}");font-display:swap}`}</style>
      )}
      {media.cover ? <img src={media.cover} alt="" className={`-mx-4 mb-0 h-40 w-[calc(100%+2rem)] max-w-none object-cover sm:h-56 ${mobileCoverPosition} ${desktopCoverPosition}`} /> : <div className="h-6" />}
      <div className={compact ? "pt-4" : ""}>{header}</div>
      {current ? (
        <section className="mt-6">
          <button type="button" onClick={() => setOpenPage(null)} className="inline-flex items-center gap-1 text-sm" style={{ color: c.accent }}><ArrowLeft className="size-4" /> {artist.studio_name}</button>
          <h2 className="mt-3 text-2xl" style={heading}>{current.title}</h2>
          {current.text && <p className="mt-3 whitespace-pre-line text-sm">{current.text}</p>}
          {current.images && current.images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {current.images.map((im) => pageUrls[im] && <img key={im} src={pageUrls[im]} alt={current.title} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />)}
            </div>
          )}
          {current.url && <a href={current.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm underline">{tx("Open link")}{" "}<ExternalLink className="size-3" /></a>}
        </section>
      ) : (
        <>{intro}{pageButtons}{order.map((n, i) => <div key={i}>{n}</div>)}</>
      )}
    </div>
  );
}
