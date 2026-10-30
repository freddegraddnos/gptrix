/**
 * One gallery design: big preview, try it in AR, and buy it (or save it when
 * the studio shared it for free).
 */
import { tx, useUiLang } from "@/lib/uiLang";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera, Download, Loader2, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useMotif, formatKr } from "@/hooks/useMarketplace";
import { MotifCheckout } from "@/components/StripeEmbeddedCheckout";
import { supabase } from "@/integrations/supabase/client";
import { placementLabel, coverageLabel } from "@/lib/motifPlacement";
import { setMotifRequestContext } from "@/lib/motifRequestContext";
import { TattooOfferFields } from "@/components/TattooOfferFields";
import { AVAILABILITY_LABELS, REUSE_LABELS, EMPTY_TATTOO_OFFER, readTattooOffer, validateTattooOffer, type TattooOffer } from "@/lib/tattooOffer";
import { Button } from "@/components/ui/button";
import { BodyPlacementPreview } from "@/components/BodyPlacementPreview";

export const Route = createFileRoute("/shop/$id")({
  head: () => ({
    meta: [
      { title: "Tattoo design — InkSimulator gallery" },
      {
        name: "description",
        content:
          "See this tattoo design up close, try it on your skin in AR and buy it straight from the studio.",
      },
      { property: "og:title", content: "Tattoo design — InkSimulator gallery" },
      {
        property: "og:description",
        content: "Try this studio design on your skin in AR, then take it to your artist.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MotifPage,
});

function MotifPage() {
  useUiLang();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { motif, loading, refresh } = useMotif(id, user?.id);
  const [offer, setOffer] = useState<TattooOffer>({ ...EMPTY_TATTOO_OFFER });
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerMessage, setOfferMessage] = useState("");
  useEffect(() => { if (motif) setOffer(readTattooOffer(motif)); }, [motif]);
  const saveOffer = async () => {
    if (!motif || user?.id !== motif.artist_id || offerSaving) return;
    const invalid = validateTattooOffer(offer);
    if (invalid) { setOfferMessage(tx(invalid)); return; }
    setOfferSaving(true); setOfferMessage("");
    try {
      const { data, error } = await supabase.from("marketplace_motifs").update(offer)
        .eq("id", motif.id).eq("artist_id", user.id).select("id").single();
      if (error || !data) throw error ?? new Error("Could not save availability.");
      setOfferMessage(tx("Availability saved. Existing enquiries and bookings are unchanged."));
      refresh();
    } catch { setOfferMessage(tx("Could not save availability. Your changes are still here; try again.")); }
    finally { setOfferSaving(false); }
  };
  const [checkout, setCheckout] = useState(false);
  const [creator, setCreator] = useState<{ handle: string; studio_name: string } | null>(null);
  useEffect(() => {
    let active = true;
    setCreator(null);
    if (motif?.artist_id) void supabase.from("artist_profiles").select("handle,studio_name")
      .eq("user_id", motif.artist_id).eq("status", "approved").eq("approval_status", "approved").maybeSingle()
      .then(({ data }) => { if (active && data?.handle) setCreator({ handle: data.handle, studio_name: data.studio_name }); });
    return () => { active = false; };
  }, [motif?.artist_id]);

  /** The camera loads gallery designs straight from their id. */
  const tryInAr = () => {
    if (creator && motif) setMotifRequestContext({ motifId: motif.id, studioId: motif.artist_id, handle: creator.handle });
    void navigate({ to: "/ar", search: { motif: id } });
  };

  const downloadClean = async () => {
    if (!motif) return;
    const { data } = await supabase.storage
      .from("marketplace")
      .createSignedUrl(motif.image_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return (
      <AppShell>
        <TopBar title="Design" />
        <div className="grid place-items-center py-20">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      </AppShell>
    );
  }

  if (!motif) {
    return (
      <AppShell>
        <TopBar title="Design" />
        <p className="py-16 text-center text-sm text-muted-foreground">
          This design is no longer available.
        </p>
        <Link
          to="/shop"
          className="mx-auto flex h-11 w-40 items-center justify-center rounded-xl border border-white/12 text-sm font-bold"
        >
          Back to gallery
        </Link>
      </AppShell>
    );
  }

  const paid = motif.price_ore > 0;
  const returnUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

  return (
    <AppShell>
      <TopBar title="Design" />
      <Link
        to="/shop"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" /> Gallery
      </Link>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-artwork">
        {motif.image_url && (
          <img src={motif.image_url} alt={motif.name} className="aspect-square w-full object-contain" />
        )}
      </div>

      <h1 className="mt-4 font-display text-2xl font-bold">{motif.name}</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {creator ? <Link to="/$handle" params={{ handle: creator.handle }} className="underline underline-offset-4">{creator.studio_name}</Link> : motif.artist_name ?? tx("Studio")}
        {motif.style ? ` · ${motif.style}` : ""}
      </p>
      {motif.description && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{motif.description}</p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {tx("Recommended for")}: {motif.placements.length ? motif.placements.map((p) => tx(placementLabel(p))).join(", ") : tx("No specific placement")}
        {" · "}{tx(coverageLabel(motif.coverage))}
      </p>
      {user?.id === motif.artist_id && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold">{tx("See a placement suggestion (optional)")}</summary>
          <div className="mt-2"><BodyPlacementPreview motifId={motif.id} imageUrl={motif.image_url} placements={motif.placements} /></div>
        </details>
      )}

      {motif.tattoo_availability && <section className="mt-4 rounded-xl border border-accent/40 p-4" aria-label={tx("Tattoo work availability")}>
        <h2 className="text-sm font-bold">{tx(AVAILABILITY_LABELS[motif.tattoo_availability])}</h2>
        {motif.tattoo_reuse && <p className="mt-1 text-sm">{tx(REUSE_LABELS[motif.tattoo_reuse])}</p>}
        {motif.suggested_size_cm && <p className="mt-1 text-sm">{tx("Suggested size")}: {motif.suggested_size_cm} cm</p>}
        {motif.tattoo_price_note && <p className="mt-1 text-sm">{tx("Tattoo price indication")}: {motif.tattoo_price_note}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{tx("Final size, price and suitability are agreed with the artist. This status does not change digital usage rights.")}</p>
      </section>}
      {user?.id === motif.artist_id && <details className="mt-4">
        <summary className="min-h-11 cursor-pointer text-sm font-bold">{tx("Edit tattoo availability")}</summary>
        <TattooOfferFields value={offer} onChange={setOffer} disabled={offerSaving} />
        <Button type="button" disabled={offerSaving} onClick={() => void saveOffer()} className="mt-2">{tx("Save availability")}</Button>
        {offerMessage && <p role="status" className="mt-2 text-sm">{offerMessage}</p>}
      </details>}
      <p className="mt-4 text-xs text-muted-foreground">{tx("Digital design")}</p>
      <p className="mt-1 text-lg font-bold text-accent">
        {paid ? formatKr(motif.price_ore) : tx("Free to try digitally")}
      </p>

      {(paid || motif.usage_terms) && (
        <div className="mt-3 rounded-xl border border-border p-3 text-sm">
          {paid && <><p className="font-bold">{tx("What you buy")}</p>
          <p className="mt-1 text-muted-foreground">{tx("The digital file, under the artist’s usage terms. Tattoo work is agreed separately.")}</p></>}
          <p className="mt-2 font-bold">{tx("Usage terms from the studio")}</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{motif.usage_terms ?? tx("Terms missing – this design cannot be bought yet.")}</p>
        </div>
      )}

      {paid && !motif.owned && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="size-3.5" /> The watermark disappears once you buy it.
        </p>
      )}

      {creator && <section className="mt-5 rounded-xl border border-border p-4">
        <p className="text-sm text-muted-foreground">{tx("Ask the creator about tattooing this design. Trying it or buying a digital file is optional.")}</p>
        <Link to="/$handle/book" params={{ handle: creator.handle }} search={{ motif: motif.id }}
          className="btn-primary mt-3 w-full" onClick={() => setMotifRequestContext({ motifId: motif.id, studioId: motif.artist_id, handle: creator.handle })}>
          {tx(motif.tattoo_availability === "available" ? "I am interested in this design" : motif.tattoo_availability ? "Ask about a similar design" : "Ask about this design")}
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">{tx("An enquiry does not reserve the design or confirm a booking.")}</p>
      </section>}
      <div className="mt-5 space-y-2">
        {paid && !motif.owned ? (
          user ? (
            checkout ? (
              <MotifCheckout motifId={motif.id} returnUrl={returnUrl} />
            ) : (
              <button
                onClick={() => setCheckout(true)}
                disabled={!motif.usage_terms}
                className="h-12 w-full rounded-xl bg-accent text-sm font-bold text-ink disabled:opacity-50"
              >
                {tx("Buy digital file")} · {formatKr(motif.price_ore)}
              </button>
            )
          ) : (
            <Link
              to="/auth"
              search={{ redirect: `/shop/${motif.id}` }}
              className="flex h-12 items-center justify-center rounded-xl bg-accent text-sm font-bold text-ink"
            >
              Sign in to buy
            </Link>
          )
        ) : (
          <button
            onClick={() => void downloadClean()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-ink"
          >
            <Download className="size-4" /> Save the design
          </button>
        )}

        <button
          onClick={tryInAr}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/12 text-sm font-bold"
        >
          <Camera className="size-4" /> Try it in AR
        </button>
      </div>
    </AppShell>
  );
}
