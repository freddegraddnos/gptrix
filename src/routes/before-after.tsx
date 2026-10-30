import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Film,
  Loader2,
  Music,
  Share2,
  Upload,
  Wand2,
} from "lucide-react";
import { tx } from "@/lib/uiLang";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { fileToDataUrl } from "@/lib/motifExtract";
import { shareFile, saveToCameraRoll } from "@/lib/share";
import { recorderSupported } from "@/lib/videoRecording";
import {
  MUSIC_TRACKS,
  TOTAL_MS,
  loadImageEl,
  renderBeforeAfterVideo,
  takeBeforeAfter,
  type TrackId,
} from "@/lib/beforeAfterVideo";

export const Route = createFileRoute("/before-after")({
  head: () => ({
    meta: [
      { title: "Before/After video — make a 9:16 clip for TikTok | InkSimulator" },
      {
        name: "description",
        content:
          "Automatically create a vertical before/after video of your tattoo try-on: NO TATTOO, InkSimulator transition and REALISTIC TATTOO with music and a caption.",
      },
      { property: "og:title", content: "Before/After video — InkSimulator" },
      {
        property: "og:description",
        content:
          "Three sequences, 1080x1920, ready for TikTok, Reels and Stories — with music and your own caption.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/before-after" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/before-after" }],
  }),
  component: BeforeAfterPage,
});

function BeforeAfterPage() {
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [caption, setCaption] = useState(() => tx("What do you think — should I get it?"));
  const [track, setTrack] = useState<TrackId>("pulse");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string } | null>(
    null,
  );

  useEffect(() => {
    const handoff = takeBeforeAfter();
    if (handoff) {
      setBefore(handoff.before);
      setAfter(handoff.after);
      if (handoff.caption) setCaption(handoff.caption);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const pick = useCallback(
    async (file: File | null | undefined, which: "before" | "after") => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please choose an image file.");
        return;
      }
      const url = await fileToDataUrl(file);
      if (which === "before") setBefore(url);
      else setAfter(url);
      setResult(null);
    },
    [],
  );

  const generate = useCallback(async () => {
    if (!before || !after) {
      toast.error("You need both a photo without and one with the tattoo.");
      return;
    }
    if (!recorderSupported()) {
      toast.error("Sorry, your browser doesn't support video recording.");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const [b, a] = await Promise.all([loadImageEl(before), loadImageEl(after)]);
      const out = await renderBeforeAfterVideo({
        before: b,
        after: a,
        caption,
        track,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(out.blob);
      setResult({ url, blob: out.blob, ext: out.ext });
      toast.success("Video is ready");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't generate the video.",
      );
    } finally {
      setBusy(false);
    }
  }, [before, after, caption, track]);

  const filename = `inksimulator-before-after.${result?.ext ?? "mp4"}`;

  const doSave = async () => {
    if (!result) return;
    await saveToCameraRoll(result.blob, filename);
    toast.success("Saved to camera roll");
  };

  const doShare = async () => {
    if (!result) return;
    const res = await shareFile(result.blob, filename, {
      title: "Before / After — InkSimulator",
      text: `${caption} · Try yours → inksimulator.com`,
    });
    if (res === "downloaded") toast.success("Video saved");
  };

  return (
    <AppShell>
      <header className="mb-5">
        <div className="text-mono-caps text-[10px] text-accent">Before / After</div>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight">
          Generate before/after video
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Three sequences in vertical 9:16 (1080×1920) for TikTok, Reels and
          Stories: <strong>NO TATTOO</strong> → InkSimulator transition →{" "}
          <strong>REALISTIC TATTOO</strong>. Total {(TOTAL_MS / 1000).toFixed(1)} sec.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {(
          [
            { key: "before" as const, src: before, label: "Without tattoo", ref: beforeRef },
            { key: "after" as const, src: after, label: "With tattoo", ref: afterRef },
          ]
        ).map((slot) => (
          <div key={slot.key}>
            <button
              type="button"
              onClick={() => slot.ref.current?.click()}
              className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-dashed border-accent/40 bg-slate/60 active:scale-[0.99] transition"
            >
              {slot.src ? (
                <img
                  src={slot.src}
                  alt={slot.label}
                  className="size-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center gap-2 text-xs text-muted-foreground">
                  <Upload className="mx-auto size-5" />
                </span>
              )}
            </button>
            <input
              ref={slot.ref}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0], slot.key)}
            />
            <p className="mt-2 text-center text-xs font-bold">{slot.label}</p>
          </div>
        ))}
      </section>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Coming from{" "}
        <Link to="/photo-tryon" search={{ motif: undefined }} className="text-accent underline">
          Paste tattoo on a picture
        </Link>{" "}
        or{" "}
        <Link to="/ar" search={{} as never} className="text-accent underline">
          Live Try-On
        </Link>{" "}
        ? Your photos will fill in automatically.
      </p>

      <section className="mt-6 space-y-4">
        <div>
          <label htmlFor="ba-caption" className="text-xs font-bold">
            Caption
          </label>
          <input
            id="ba-caption"
            value={caption}
            maxLength={90}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            className="mt-1 w-full rounded-xl border border-border bg-slate/60 px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Music className="size-3.5 text-accent" /> Background music
          </div>
          <div className="mt-2 grid gap-2">
            {MUSIC_TRACKS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrack(t.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                  track === t.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-slate/50"
                }`}
              >
                <span className="font-bold">{t.label}</span>
                <span className="text-[11px] text-muted-foreground">{t.hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tracks are generated in the app and are royalty-free — use them
            freely on social media.
          </p>
        </div>

        <Button
          className="w-full rounded-full"
          disabled={busy || !before || !after}
          onClick={() => void generate()}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Rendering… {progress}%
            </>
          ) : (
            <>
              <Wand2 className="mr-2 size-4" /> Generate video
            </>
          )}
        </Button>
      </section>

      {result && (
        <section className="mt-6 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={result.url}
              controls
              autoPlay
              loop
              playsInline
              className="mx-auto aspect-[9/16] max-h-[70vh] w-full object-contain"
            />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 rounded-full" onClick={() => void doShare()}>
              <Share2 className="mr-2 size-4" /> Share
            </Button>
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => void doSave()}
            >
              <Download className="mr-2 size-4" /> Save to camera roll
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            <Film className="mr-1 inline size-3" /> 1080×1920 · InkSimulator logo
            burned in
          </p>
        </section>
      )}
    </AppShell>
  );
}
