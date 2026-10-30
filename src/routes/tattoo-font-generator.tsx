import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Type, Camera, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  TATTOO_FONTS,
  customTattooFonts,
  renderTextMotif,
  type TattooFont,
  type TextForm,
} from "@/lib/tattooFonts";
import { saveMyMotif } from "@/lib/myMotifs";
import { FontCatalogDialog } from "@/components/paint/FontCatalogDialog";
import {
  loadStoredCustomFonts,
  removeCustomFont,
  subscribeCustomFonts,
} from "@/lib/paint/customFonts";
import { Button } from "@/components/ui/button";
import { SeoInfo } from "@/components/SeoInfo";

const TITLE = "Free Tattoo Font Generator – Text, Lettering & AR Try-On | InkSimulator";
const DESCRIPTION =
  "Create a text tattoo with 18 tattoo fonts: compare lettering, script and blackletter, curve your text and preview tattoo placement in AR. Free text design tool.";
import { seo } from "@/lib/seo";
const URL = "https://www.inksimulator.com/tattoo-font-generator";

export const Route = createFileRoute("/tattoo-font-generator")({
  head: () =>
    seo({ path: "/tattoo-font-generator", title: TITLE, description: DESCRIPTION, breadcrumb: "Tattoo font generator", jsonLd: [{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "InkSimulator Tattoo Font Generator",
          url: URL,
          applicationCategory: "DesignApplication",
          operatingSystem: "Web",
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }] }),
  component: TattooFontGenerator,
});

const FORMS: { id: TextForm; label: string }[] = [
  { id: "horizontal", label: "Horizontal" },
  { id: "vertical", label: "Vertical" },
  { id: "arc", label: "Arc" },
  { id: "circle", label: "Full circle" },
];

function TattooFontGenerator() {
  const navigate = useNavigate();
  const [text, setText] = useState("Forever");
  const [fontId, setFontId] = useState(TATTOO_FONTS[0].id);
  const [curve, setCurve] = useState(0);
  const [form, setForm] = useState<TextForm>("horizontal");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [custom, setCustom] = useState<TattooFont[]>([]);

  useEffect(() => {
    const sync = () => setCustom(customTattooFonts());
    void loadStoredCustomFonts().then(sync);
    sync();
    return subscribeCustomFonts(sync);
  }, []);

  const fonts = useMemo(() => [...custom, ...TATTOO_FONTS], [custom]);
  const groups = useMemo(() => Array.from(new Set(fonts.map((f) => f.style))), [fonts]);

  const font = useMemo<TattooFont>(
    () => fonts.find((f) => f.id === fontId) ?? TATTOO_FONTS[0],
    [fonts, fontId],
  );

  const dropFont = useCallback((id: string) => {
    removeCustomFont(id);
    setFontId((current) => current === id ? TATTOO_FONTS[0].id : current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      void renderTextMotif({ text, font, letterSpacing, curve, form })
        .then((url) => {
          if (!cancelled) setPreview(url);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, font, letterSpacing, curve, form]);

  async function tryInAr() {
    try {
      const url = preview || (await renderTextMotif({ text, font, letterSpacing, curve, form }));
      if (!url) throw new Error("Could not render the lettering");
      saveMyMotif({ name: text.slice(0, 40) || "Text", src: url, source: "text" });
      toast.success("Saved to My designs — open it in the camera");
      void navigate({ to: "/ar" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the design");
    }
  }

  return (
    <AppShell>
      <header className="mb-6">
        <div className="text-mono-caps text-[10px] text-accent">Free tool</div>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight">
          Tattoo font generator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Type your word or name, preview it in {TATTOO_FONTS.length} tattoo
          fonts — script, blackletter, stencil and handwriting — bend the
          lettering to follow an arm or collarbone, then try it on your own
          skin at 1:1 scale in AR.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <label
          htmlFor="tattoo-text"
          className="text-mono-caps text-[10px] text-muted-foreground"
        >
          Your text
        </label>
        <input
          id="tattoo-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Forever"
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink/60 px-3 py-2.5 text-base outline-none focus:border-accent/60"
        />

        <div
          className="mt-4 grid min-h-32 place-items-center rounded-xl bg-white/[0.06] p-4"
          aria-live="polite"
        >
          {busy && !preview ? (
            <Loader2 className="size-5 animate-spin text-accent" />
          ) : preview ? (
            <img
              src={preview}
              alt={`The text "${text}" in the tattoo font ${font.label}`}
              className="max-h-40 w-auto max-w-full invert"
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Type something to see the preview.
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="text-mono-caps text-[10px] text-muted-foreground">Text shape</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Text shape">
              {FORMS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={form === option.id ? "default" : "outline"}
                  aria-pressed={form === option.id}
                  onClick={() => setForm(option.id)}
                  className="h-11 px-2"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          {form === "arc" && (
          <div>
            <label
              htmlFor="curve"
              className="text-mono-caps text-[10px] text-muted-foreground"
            >
              Curve
            </label>
            <input
              id="curve"
              type="range"
              min={-60}
              max={60}
              value={curve}
              onChange={(e) => setCurve(Number(e.target.value))}
              className="mt-1.5 w-full accent-accent"
            />
          </div>
          )}
          <div>
            <label
              htmlFor="spacing"
              className="text-mono-caps text-[10px] text-muted-foreground"
            >
              Letter spacing
            </label>
            <input
              id="spacing"
              type="range"
              min={0}
              max={40}
              value={letterSpacing}
              onChange={(e) => setLetterSpacing(Number(e.target.value))}
              className="mt-1.5 w-full accent-accent"
            />
          </div>
        </div>

        <Button
          onClick={() => void tryInAr()}
          className="mt-5 h-12 w-full font-display font-bold active:scale-[0.99]"
        >
          <Camera className="size-4" strokeWidth={2.5} />
          Try it on my skin in AR
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Free — no account needed. The lettering is saved as a transparent PNG
          in My designs.
        </p>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Pick a tattoo font</h2>
          <Button type="button" variant="outline" className="h-11" onClick={() => setCatalogOpen(true)}>
            <Search className="size-4" /> Font catalogue
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Every font below is a real lettering style tattooers use. Tap one to
          see your own text in it.
        </p>
        {groups.map((group) => (
          <div key={group} className="mt-5">
            <div className="text-mono-caps text-[10px] text-accent">{group}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {fonts.filter((f) => f.style === group).map((f) => (
                <div key={f.id} className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFontId(f.id)}
                    aria-pressed={f.id === fontId}
                    className={`h-auto min-h-14 w-full justify-start px-3 py-3 text-left ${
                      f.id === fontId ? "border-accent bg-accent/10" : "bg-card"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-xl leading-tight"
                    style={{ fontFamily: `"${f.family}", cursive`, fontWeight: f.weight }}
                  >
                    {text || f.label}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {f.label}
                  </span>
                    </span>
                  </Button>
                  {f.custom && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => dropFont(f.id)}
                      className="absolute bottom-1 right-1 size-9"
                      aria-label={`Remove ${f.label}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <FontCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onInstalled={(id) => {
          setCustom(customTattooFonts());
          setFontId(id);
          setCatalogOpen(false);
        }}
      />

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold tracking-tight">
          How the tattoo font generator works
        </h2>
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">1. Type your text.</span>{" "}
            A name, a date, a quote — line breaks are kept.
          </li>
          <li>
            <span className="font-semibold text-foreground">2. Choose a font and curve.</span>{" "}
            Script and blackletter suit forearms and ribs; stencil and Roman
            caps read well on smaller placements.
          </li>
          <li>
            <span className="font-semibold text-foreground">3. Try it in AR.</span>{" "}
            The lettering is placed on your skin at true 1:1 size, so you can
            judge length and placement before you book.
          </li>
        </ol>
      </section>

      <section className="mt-10 grid gap-3">
        <Link
          to="/library"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 active:scale-[0.99] transition"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10">
            <Type className="size-5 text-accent" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-bold">
              Browse tattoo designs
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Combine your lettering with a curated design from our artists.
            </p>
          </div>
          <span className="text-lg text-accent" aria-hidden>
            →
          </span>
        </Link>
        <Link
          to="/generator"
          className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-4 active:scale-[0.99] transition"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/20">
            <Sparkles className="size-5 text-accent" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-bold">AI generator</div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Turn a prompt into a unique design and try it on in AR.
            </p>
          </div>
          <span className="text-lg text-accent" aria-hidden>
            →
          </span>
        </Link>
      </section>
      <SeoInfo
        title="Tattoo lettering generator"
        intro="Type a name, date or quote and preview it in 18 tattoo fonts — script, blackletter, stencil and more. Set the lettering straight, vertical, arched or in a circle, then try the text tattoo on your skin in AR."
        sections={[
          { h: "Choosing a tattoo font", p: "Script and cursive fonts suit names and short words; blackletter and Old English give a bold, classic look; thin sans-serif lettering works for minimalist fine line tattoos." },
          { h: "Check the size on your body", p: "Small lettering can blur over time. Preview the text at real size in AR and ask your tattoo artist how small the letters can safely be." },
        ]}
        links={[
          { to: "/ar", label: "Try a tattoo in AR" },
          { to: "/generator", label: "AI tattoo generator" },
          { to: "/library", label: "Tattoo designs" },
        ]}
      />
    </AppShell>
  );
}
