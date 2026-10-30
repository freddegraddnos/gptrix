import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Upload,
  X,
  Wand2,
  Camera,
  Download,
  Loader2,
  Lock,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { generateTattoo } from "@/lib/generator.functions";
import { removeBackgroundFromDataUrl } from "@/lib/transparency";
import { useAccess } from "@/lib/access";
import { saveMyMotif } from "@/lib/myMotifs";
import { useAuth } from "@/hooks/useAuth";
import { setPendingRedirect } from "@/lib/authRedirect";
import { seo } from "@/lib/seo";
import { SeoInfo } from "@/components/SeoInfo";

export const Route = createFileRoute("/generator")({
  head: () => seo({ path: "/generator", title: "AI Tattoo Generator – Create Tattoo Designs & Try On in AR | InkSimulator", description: "Create tattoo ideas with an AI tattoo generator, choose a style and add reference images. Account and access required. Preview designs in AR or on a photo.", breadcrumb: "AI generator" }),
  component: GeneratorPage,
  // Opening the generator loads its chunk — show that instead of a blank page.
  pendingMs: 200,
  pendingComponent: () => (
    <AppShell>
      <TopBar title="AI Generator" />
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-6 text-accent animate-spin" />
        <p className="text-sm text-muted-foreground">Opening the AI creator…</p>
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }: ErrorComponentProps) => (
    <AppShell>
      <TopBar title="AI Generator" />
      <div className="mt-16 text-center">
        <h1 className="font-display text-xl font-bold">
          The AI creator didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error)?.message || "Check your connection and try again."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
        >
          Reload
        </button>
      </div>
    </AppShell>
  ),
});

const STYLES = [
  { id: "blackwork", label: "Blackwork" },
  { id: "fineline", label: "Fine line" },
  { id: "traditional", label: "Traditional" },
  { id: "realism", label: "Realism" },
  { id: "watercolor", label: "Watercolor" },
  { id: "geometric", label: "Geometric" },
  { id: "japanese", label: "Japanese" },
  { id: "neotraditional", label: "Neo-trad" },
  { id: "dotwork", label: "Dotwork" },
  { id: "tribal", label: "Tribal" },
];

const BODY_PARTS = [
  "forearm",
  "upper arm",
  "shoulder",
  "back",
  "chest",
  "ribs",
  "thigh",
  "calf",
  "wrist",
  "hand",
  "neck",
  "foot",
];

const GENERATED_KEY = "inkvision.generated.motif";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function GeneratorPage() {
  const navigate = useNavigate();
  const { subscribed } = useAccess();
  const [style, setStyle] = useState("blackwork");
  const [bodyPart, setBodyPart] = useState("forearm");
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Visible progress while the AI works — the call regularly takes 15–40s and
  // silence reads as a broken page.
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    void import("@/hooks/useJourney").then(({ markFlag }) =>
      markFlag("advisor"),
    );
  }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: string[] = [];
    for (const f of Array.from(files).slice(0, 3 - refs.length)) {
      if (!f.type.startsWith("image/")) continue;
      next.push(await fileToDataUrl(f));
    }
    setRefs((r) => [...r, ...next].slice(0, 3));
  };

  const generate = async () => {
    if (!user) {
      setPendingRedirect("/generator");
      navigate({ to: "/auth", search: { redirect: "/generator" } as never });
      return;
    }
    if (!subscribed) {
      navigate({ to: "/" });
      return;
    }
    if (!prompt.trim() && refs.length === 0) {
      setErr("Describe the motif or upload at least one reference.");
      return;
    }
    setErr(null);
    setLoading(true);
    setStage("Sending your idea to the AI…");
    setResults([]);
    try {
      const res = await generateTattoo({
        data: {
          style,
          bodyPart,
          prompt: prompt.trim(),
          referenceDataUrls: refs,
          variations: 3,
        },
      });
      if ("error" in res) setErr(res.error);
      else {
        // AI motifs come on a white background — make white transparent right away
        // so they work in AR and for printing.
        setStage("Cutting out the background…");
        const cleaned = await Promise.all(
          res.images.map(async (img) => {
            try {
              return await removeBackgroundFromDataUrl(img, {
                edgesOnly: false,
              });
            } catch {
              return img;
            }
          }),
        );
        setResults(cleaned);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setErr(
        /fetch|network|Failed to fetch/i.test(msg)
          ? "No connection to the AI service. Check your network and try again."
          : msg || "The AI couldn't finish this one. Try again, or tweak your description.",
      );
    } finally {
      setLoading(false);
      setStage(null);
    }
  };

  const tryInAr = (dataUrl: string) => {
    try {
      sessionStorage.setItem(GENERATED_KEY, dataUrl);
    } catch {
      /* quota */
    }
    // Also keep it in the one shared design store, so the generated design is
    // reachable later from My Designs, Photo Try-On and the camera strip.
    try {
      saveMyMotif({ name: "AI design", src: dataUrl, source: "ai" });
    } catch {
      /* ignore */
    }
    navigate({ to: "/ar", search: { motif: "generated" } as never });
  };

  const download = (dataUrl: string, i: number) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `inksimulator-generated-${i + 1}.png`;
    a.click();
  };

  return (
    <AppShell>
      <TopBar title="AI Generator" />

      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="size-4 text-accent" />
        <span className="text-mono-caps text-[10px] text-accent">New · AI</span>
      </div>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
        Create your tattoo with AI
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose a style, upload references and describe your dream tattoo. Try it
        directly in AR once it's ready.
      </p>

      {/* Style */}
      <section className="mt-6">
        <div className="text-mono-caps text-[10px] text-muted-foreground mb-2">
          1 · Style
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              aria-pressed={style === s.id}
              className={`h-9 px-3 rounded-full border text-[13px] font-medium transition-colors ${
                style === s.id
                  ? "control-selected"
                  : "border-white/10 bg-slate/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {style === s.id && <span aria-hidden="true">✓ </span>}
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* References */}
      <section className="mt-6">
        <div className="text-mono-caps text-[10px] text-muted-foreground mb-2">
          2 · Reference images (optional, max 3)
        </div>
        <div className="grid grid-cols-3 gap-2">
          {refs.map((r, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-xl overflow-hidden border border-white/10"
            >
              <img src={r} alt={`ref ${i}`} className="size-full object-cover" />
              <button
                onClick={() => setRefs((rs) => rs.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 size-6 rounded-full bg-ink/80 grid place-items-center"
                aria-label="Remove"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {refs.length < 3 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-xl border border-dashed border-white/15 grid place-items-center text-muted-foreground hover:text-accent hover:border-accent/50 transition"
            >
              <div className="flex flex-col items-center gap-1">
                <Upload className="size-5" />
                <span className="text-[10px] uppercase tracking-widest font-bold">
                  Upload
                </span>
              </div>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void addFiles(e.target.files)}
        />
      </section>

      {/* Prompt */}
      <section className="mt-6">
        <label htmlFor="generator-prompt" className="block text-mono-caps text-[10px] text-muted-foreground mb-2">
          3 · Describe the motif
        </label>
        <textarea
          id="generator-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="E.g. An eagle with spread wings, geometric patterns in the background, dramatic shading..."
          className="w-full rounded-2xl bg-slate/60 border border-white/10 p-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent resize-none"
        />
      </section>

      {/* Body part */}
      <section className="mt-4">
        <div className="text-mono-caps text-[10px] text-muted-foreground mb-2">
          4 · Body part
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BODY_PARTS.map((b) => (
            <button
              key={b}
              onClick={() => setBodyPart(b)}
              aria-pressed={bodyPart === b}
              className={`h-9 px-3 rounded-full border text-[13px] font-medium transition-colors ${
                bodyPart === b
                  ? "control-selected"
                  : "border-white/10 text-muted-foreground"
              }`}
            >
              {bodyPart === b && <span aria-hidden="true">✓ </span>}
              {b}
            </button>
          ))}
        </div>
      </section>

      {/* CTA */}
      <button
        onClick={() => void generate()}
        disabled={loading}
        className="mt-6 w-full h-14 rounded-2xl bg-accent text-ink font-medium text-[15px] transition-shadow shadow-[0_10px_40px_-10px_rgba(138,91,242,0.55)] flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating...
          </>
        ) : subscribed ? (
          <>
            <Wand2 className="size-4" strokeWidth={2.5} />
            Generate 3 designs
          </>
        ) : (
          <>
            <Lock className="size-4" strokeWidth={2.5} />
            Unlock AI Generator
          </>
        )}
      </button>

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-xl border border-white/10 bg-slate/50 p-3 text-center"
        >
          <p className="text-[12px] text-foreground">{stage ?? "Working…"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {elapsed < 20
              ? `Usually 15–40 seconds · ${elapsed}s`
              : elapsed < 45
                ? `Still drawing — hang on · ${elapsed}s`
                : `Taking longer than usual · ${elapsed}s. You can keep waiting or try again.`}
          </p>
        </div>
      )}

      {err && !loading && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center"
        >
          <p className="text-[12px] text-destructive">{err}</p>
          <button
            onClick={() => void generate()}
            className="mt-2 h-10 px-4 rounded-lg border border-white/15 text-[12px] font-bold"
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {(loading || results.length > 0) && (
        <section className="mt-8">
          <div className="text-mono-caps text-[10px] text-accent mb-3">
            Your designs
          </div>
          <div className="grid grid-cols-1 gap-3">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl border border-white/10 bg-slate/40 grid place-items-center animate-pulse"
                >
                  <Loader2 className="size-6 text-accent animate-spin" />
                </div>
              ))}
            {results.map((r, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 overflow-hidden bg-slate/40"
              >
                <div className="aspect-square bg-white">
                  <img
                    src={r}
                    alt={`Design ${i + 1}`}
                    className="size-full object-contain"
                  />
                </div>
                <div className="p-3 flex gap-2">
                  <button
                    onClick={() => tryInAr(r)}
                    className="flex-1 h-11 rounded-xl bg-accent text-ink font-medium text-[15px] flex items-center justify-center gap-1.5"
                  >
                    <Camera className="size-4" strokeWidth={2.5} />
                    Try in AR
                  </button>
                  <button
                    onClick={() => download(r, i)}
                    className="h-11 px-4 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[15px] font-medium"
                    aria-label="Download"
                  >
                    <Download className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-[10px] text-muted-foreground">
        AI-generated motifs are drafts — always verify with your tattoo artist.
      </p>
      <SeoInfo
        title="AI tattoo generator"
        intro="Describe a tattoo idea in your own words and the AI tattoo generator draws a first design with a transparent background. You can then try the design on your skin in live AR at 1:1 scale or on a photo before you take it to a tattoo artist."
        sections={[
          { h: "How to write a good prompt", p: "Name the subject, the style and the level of detail — for example “fine line swallow with a small rose” or “blackwork moth, symmetrical, bold lines”. Short, specific prompts give cleaner tattoo designs." },
          { h: "From idea to preview", p: "Generate a draft, save it to your designs and open it in AR to check size and placement on your arm, leg or wherever you plan the tattoo." },
          { h: "A draft, not a finished stencil", p: "AI tattoo designs are a starting point. Your tattoo artist adapts the line work, size and placement to your body." },
        ]}
        links={[
          { to: "/ar", label: "Try a tattoo in AR" },
          { to: "/tattoo-font-generator", label: "Tattoo font generator" },
          { to: "/library", label: "Tattoo designs" },
          { to: "/guides/placement-guide", label: "Placement guide" },
        ]}
      />
    </AppShell>
  );
}
