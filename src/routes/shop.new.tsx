import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload as UploadIcon, Loader2 } from "lucide-react";
import { listMyMotifs, subscribeMyMotifs, type MyMotif } from "@/lib/myMotifs";
import { useServerFn } from "@tanstack/react-start";
import { STYLES, TYPES, type TattooType } from "@/lib/tattoos";
import { tx } from "@/lib/uiLang";
import goodExample from "@/assets/motif-example-good.jpg";
import badExample from "@/assets/motif-example-bad.jpg";
import { PLACEMENTS, COVERAGES, NO_PLACEMENT_LABEL, validatePlacement, type CoverageId } from "@/lib/motifPlacement";
import { TattooOfferFields } from "@/components/TattooOfferFields";
import { EMPTY_TATTOO_OFFER, validateTattooOffer, type TattooOffer } from "@/lib/tattooOffer";
import { BodyPlacementPreview } from "@/components/BodyPlacementPreview";
import { getStudioApproval, type StudioApprovalState } from "@/lib/studioApproval.functions";

export const Route = createFileRoute("/shop/new")({
  head: () => ({
    meta: [
      { title: "List a design — InkSimulator" },
      { name: "description", content: "Share your own tattoo designs for free on InkSimulator." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewMotifPage,
});

function NewMotifPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  /** Free designs are marketing; paid designs stay watermarked until bought. */
  const [tattooOffer, setTattooOffer] = useState<TattooOffer>({ ...EMPTY_TATTOO_OFFER });
  const [paid, setPaid] = useState(false);
  const [priceKr, setPriceKr] = useState("199");
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"upload" | "saved">("upload");
  const [saved, setSaved] = useState<MyMotif[]>([]);
  const [style, setStyle] = useState<string>("");
  const [category, setCategory] = useState<TattooType | "">("");
  const [placements, setPlacements] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<CoverageId>("single");
  const [published, setPublished] = useState<{ id: string; url: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const loadApproval = useServerFn(getStudioApproval);
  const [approval, setApproval] = useState<StudioApprovalState | null>(null);
  const [guideReturn, setGuideReturn] = useState<number | null>(null);

  useEffect(() => {
    const step = Number(new URLSearchParams(window.location.search).get("guide")?.replace(/^"|"$/g, ""));
    if (step === 9) setGuideReturn(step);
  }, []);

  useEffect(() => {
    const sync = () => setSaved(listMyMotifs());
    sync();
    return subscribeMyMotifs(sync);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadApproval({ data: undefined }).then(setApproval).catch(() => setApproval(null));
  }, [user, loadApproval]);



  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const onPickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  /** Sell a drawing or lettering design that is already saved on this device. */
  const pickSaved = async (m: MyMotif) => {
    setError(null);
    try {
      const blob = await (await fetch(m.src)).blob();
      const ext = blob.type.includes("jpeg") ? "jpg" : "png";
      setFile(new File([blob], `${m.name || "design"}.${ext}`, { type: blob.type || "image/png" }));
      setPreview(m.src);
      if (!name.trim()) setName(m.name);
    } catch {
      setError("That design could not be read.");
    }
  };

  const submit = async () => {
    if (!user || !file || !name.trim() || !style || !category) {
      setError("Add an image, a name, a style and a category for the design.");
      return;
    }
    if (paid && terms.trim().length < 10) {
      setError(tx("Write the usage terms before offering the design for sale."));
      return;
    }
    const offerError = validateTattooOffer(tattooOffer);
    if (offerError) { setError(tx(offerError)); return; }
    const placementError = validatePlacement(placements, coverage);
    if (placementError) {
      setError(tx(placementError));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("marketplace")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase.from("marketplace_motifs").insert({
        ...(tattooOffer.tattoo_availability ? tattooOffer : {}),
        placements,
        coverage,
        artist_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        image_path: path,
        style,
        category,
        price_ore: paid ? Math.round(Number(priceKr) * 100) : 0,
        usage_terms: (paid || tattooOffer.tattoo_availability) ? terms.trim() || null : null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        published: true,
      }).select("id").single();

      if (insErr) throw insErr;

      setPublished({ id: inserted.id, url: URL.createObjectURL(file) });
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (published) {
    return (
      <AppShell>
        <TopBar title={tx("Design published")} />
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <p className="text-sm">{tx("Your design is published.")}</p>
          {showPreview ? (
            <BodyPlacementPreview motifId={published.id} imageUrl={published.url} placements={placements} />
          ) : (
            <Button type="button" variant="outline" className="w-full" onClick={() => setShowPreview(true)}>{tx("See a placement suggestion (optional)")}</Button>
          )}
          <Button type="button" className="w-full" onClick={() => navigate({ to: "/shop" })}>{tx("Go to the gallery")}</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title="List a design" />
      {guideReturn && <Link to="/artists/dashboard" search={{ guide: String(guideReturn) }} className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs font-bold text-accent"><ArrowLeft className="size-4" /> Back to guide · 9</Link>}
      <Link
        to="/shop"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>
      <h1 className="font-display font-bold text-2xl mb-4">Share a design</h1>
      <p className="-mt-2 mb-4 text-xs text-muted-foreground">
        Share a design for free to reach new clients, or set a price and sell it.
      </p>

      {approval && approval.status !== "approved" && (
        <div className="mb-4 rounded-xl border border-white/15 bg-slate p-4 text-xs text-muted-foreground">
          <p className="text-sm font-bold text-foreground">
            {approval.status === "requested"
              ? "Waiting for approval"
              : "Only approved studios can list designs"}
          </p>
          <p className="mt-1">
            {approval.status === "requested"
              ? "We're reviewing your studio. You can list designs as soon as it's approved."
              : "Fill in your studio profile and press “Ask to join” — we'll get back to you by email."}
          </p>
          <Link
            to="/artists/dashboard"
            className="mt-3 inline-flex h-10 items-center rounded-xl border border-accent/60 px-4 text-[11px] font-bold uppercase tracking-widest text-accent"
          >
            Open studio panel
          </Link>
        </div>
      )}



      <div className="space-y-4">
        <div>
          <div className="text-mono-caps text-[10px] text-accent mb-2">{tx("Design image")}</div>
          <div className="mb-3 rounded-xl border border-border p-3 text-sm">
            <p className="font-bold">{tx("Upload the design itself as a flat image on a white background, without perspective or photographed skin.")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tx("This makes the design easier to show on the body in digital try-on. Photos of finished tattoos belong in Gallery – they do not need to work as a design image.")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <figure><img src={goodExample} alt={tx("Good: flat design on white")} loading="lazy" width={816} height={816} className="aspect-square w-full rounded-lg object-cover" /><figcaption className="mt-1 text-xs">✓ {tx("Good: flat design on white")}</figcaption></figure>
              <figure><img src={badExample} alt={tx("Needs adjusting: photo of a tattoo on skin")} loading="lazy" width={816} height={816} className="aspect-square w-full rounded-lg object-cover" /><figcaption className="mt-1 text-xs">✕ {tx("Needs adjusting: photo of a tattoo on skin")}</figcaption></figure>
            </div>
          </div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSource("upload")}
              className={`h-10 flex-1 rounded-xl text-xs font-bold ${source === "upload" ? "bg-accent text-ink" : "border border-white/15"}`}
            >
              Upload a file
            </button>
            <button
              type="button"
              onClick={() => setSource("saved")}
              className={`h-10 flex-1 rounded-xl text-xs font-bold ${source === "saved" ? "bg-accent text-ink" : "border border-white/15"}`}
            >
              My drawings & text
            </button>
          </div>

          {source === "upload" ? (
            <label className="block">
              <div className="aspect-square rounded-2xl border border-dashed border-white/20 bg-slate/40 grid place-items-center relative overflow-hidden">
                {preview ? (
                  <img src={preview} alt="" className="w-full h-full object-contain p-4" />
                ) : (
                  <div className="text-center text-muted-foreground text-xs">
                    <UploadIcon className="size-6 mx-auto mb-2" />
                    Choose PNG/JPG · transparent background preferred
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </label>
          ) : saved.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-slate p-4 text-xs text-muted-foreground">
              Nothing saved yet — draw something or make a lettering design first.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {saved.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickSaved(m)}
                  className={`aspect-square overflow-hidden rounded-xl bg-artwork ${
                    preview === m.src ? "border-2 border-accent" : "border border-white/15"
                  }`}
                  title={m.name}
                >
                  <img src={m.src} alt={m.name} className="size-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-mono-caps text-[10px] text-accent mb-2">Category</div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={category === value ? "default" : "outline"}
                onClick={() => setCategory(value)}
                className="rounded-full text-xs"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="text-mono-caps text-[10px] text-accent mb-2">Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="E.g. Neo-traditional wolf"
            className="w-full h-11 px-3 rounded-xl bg-slate border border-white/10 text-sm"
          />
        </label>

        <label className="block">
          <div className="text-mono-caps text-[10px] text-accent mb-2">Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Tell us about the design, style, size..."
            className="w-full px-3 py-2 rounded-xl bg-slate border border-white/10 text-sm"
          />
        </label>

        <div>
          <div className="text-mono-caps text-[10px] text-accent mb-2">Style</div>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
                <Button
                key={s}
                type="button"
                  size="sm"
                  variant={style === s ? "default" : "outline"}
                onClick={() => setStyle(s)}
                  className="rounded-full text-xs"
              >
                {s}
                </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-mono-caps text-[10px] text-accent mb-1">{tx("Recommended placement (optional)")}</div>
          <p className="mb-2 text-xs text-muted-foreground">{tx("Customers can filter by body part. The design is never locked to it.")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={placements.length === 0 ? "default" : "outline"} onClick={() => setPlacements([])} className="rounded-full text-xs">{tx(NO_PLACEMENT_LABEL)}</Button>
            {PLACEMENTS.map((p) => (
              <Button key={p.id} type="button" size="sm" variant={placements.includes(p.id) ? "default" : "outline"} aria-pressed={placements.includes(p.id)}
                onClick={() => setPlacements((cur) => cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id])} className="rounded-full text-xs">{tx(p.label)}</Button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-mono-caps text-[10px] text-accent mb-1">{tx("Coverage")}</div>
          <p className="mb-2 text-xs text-muted-foreground">{tx("For a sleeve, choose Arm or Leg as placement.")}</p>
          <div className="flex flex-wrap gap-2">
            {COVERAGES.map((c) => (
              <Button key={c.id} type="button" size="sm" variant={coverage === c.id ? "default" : "outline"} onClick={() => setCoverage(c.id)} className="rounded-full text-xs">{tx(c.label)}</Button>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="text-mono-caps text-[10px] text-accent mb-2">
            Tags (comma-separated)
          </div>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="animal, blackwork, arm"
            className="w-full h-11 px-3 rounded-xl bg-slate border border-white/10 text-sm"
          />
        </label>

        <TattooOfferFields value={tattooOffer} onChange={setTattooOffer} disabled={submitting} />

        <div className="rounded-xl border border-white/10 bg-slate p-3">
          <div className="text-mono-caps text-[10px] text-accent mb-2">{tx("What do you offer?")}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaid(false)}
              className={`h-10 flex-1 rounded-xl text-xs font-bold ${!paid ? "bg-accent text-ink" : "border border-white/15"}`}
            >
              {tx("Show for client requests")}
            </button>
            <button
              type="button"
              onClick={() => setPaid(true)}
              className={`h-10 flex-1 rounded-xl text-xs font-bold ${paid ? "bg-accent text-ink" : "border border-white/15"}`}
            >
              {tx("Offer for sale")}
            </button>
          </div>
          {paid ? (
            <label className="mt-3 block">
              <span className="text-[11px] text-muted-foreground">Price in kr</span>
              <input
                type="number"
                min={20}
                step={10}
                value={priceKr}
                onChange={(e) => setPriceKr(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-ink px-3 text-sm"
              />
              <span className="mt-2 block text-[11px] text-muted-foreground">
                Shown with an InkSimulator watermark across the whole design everywhere
                until a client buys it.
              </span>
              <span className="mt-3 block text-[11px] text-muted-foreground">{tx("Usage terms (required): what the client buys and may do with the design")}</span>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} maxLength={2000}
                placeholder={tx("E.g. One personal tattoo. No resale, printing or sharing of the file.")}
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm" />
            </label>
          ) : (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {tx("Free to try digitally. Not for sale – clients can try it in AR and send you a request.")}
            </p>
          )}
        </div>



        {!paid && tattooOffer.tattoo_availability && <label className="block text-sm">
          {tx("Usage terms for digital previews (optional)")}
          <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} maxLength={2000} className="mt-1 w-full rounded-xl border border-border bg-background p-3" />
        </label>}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
            {error}
          </div>
        )}

        <button
          disabled={submitting || (approval !== null && approval.status !== "approved")}
          onClick={submit}
          className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Publish design
        </button>
      </div>
    </AppShell>
  );
}
