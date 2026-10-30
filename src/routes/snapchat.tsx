/**
 * Snapchat — turn any InkSimulator design into a Snapchat-ready sticker so the
 * tattoo can be tried on and shared inside Snapchat, plus the asset pack and
 * steps a creator needs to publish it as a real Lens in Lens Studio.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  Ghost,
  Loader2,
  Package,
  Share2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { TATTOOS } from "@/lib/tattoos";
import { downloadBlob, saveToCameraRoll, shareLink } from "@/lib/share";

export const Route = createFileRoute("/snapchat")({
  head: () => ({
    meta: [
      { title: "Snapchat tattoo filter — try ink in AR | InkSimulator" },
      {
        name: "description",
        content:
          "Turn any InkSimulator tattoo design into a Snapchat sticker, try it on in Snapchat's camera and share it — plus the Lens Studio asset pack for creators.",
      },
      { property: "og:title", content: "InkSimulator tattoo filter for Snapchat" },
      {
        property: "og:description",
        content:
          "Export a tattoo design as a transparent Snapchat sticker and share your try-on with friends.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/snapchat" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/snapchat" }],
  }),
  component: SnapchatPage,
});

/** Renders the motif onto a transparent 1024px canvas Snapchat accepts. */
async function stickerBlob(src: string): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const scale = Math.min(size / img.width, size / img.height) * 0.9;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Export failed");
  return blob;
}

function SnapchatPage() {
  const [selected, setSelected] = useState(TATTOOS[0].id);
  const [busy, setBusy] = useState<"save" | "download" | null>(null);
  const [packing, setPacking] = useState(false);
  const motif = useMemo(
    () => TATTOOS.find((t) => t.id === selected) ?? TATTOOS[0],
    [selected],
  );

  const run = async (kind: "save" | "download") => {
    setBusy(kind);
    try {
      const blob = await stickerBlob(motif.src);
      const filename = `inksimulator-${motif.id}-snapchat.png`;
      if (kind === "save") {
        await saveToCameraRoll(blob, filename);
        toast.success("Sticker saved — open Snapchat and add it from your camera roll.");
      } else {
        downloadBlob(blob, filename);
        toast.success("Sticker downloaded");
      }
    } catch {
      toast.error("Could not export the sticker. Try another design.");
    } finally {
      setBusy(null);
    }
  };


  /**
   * Builds the complete Lens Studio asset pack: every design as a transparent
   * 1024px PNG plus a manifest and import notes, zipped in the browser.
   */
  const buildLensPack = async () => {
    setPacking(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const textures = zip.folder("textures");
      const manifest: Array<{ id: string; name: string; file: string }> = [];
      for (const t of TATTOOS.slice(0, 24)) {
        try {
          const blob = await stickerBlob(t.src);
          const file = `${t.id}.png`;
          textures?.file(file, blob);
          manifest.push({ id: t.id, name: t.name, file: `textures/${file}` });
        } catch {
          // Skip designs that fail to decode rather than losing the whole pack.
        }
      }
      if (manifest.length === 0) throw new Error("empty");
      zip.file(
        "manifest.json",
        JSON.stringify(
          {
            lens: "InkSimulator Tattoo Try-On",
            website: "https://www.inksimulator.com",
            blendMode: "Multiply",
            recommendedTemplate: "Body Morph / Hand Tracking",
            designs: manifest,
          },
          null,
          2,
        ),
      );
      zip.file(
        "README.txt",
        [
          "InkSimulator Lens asset pack",
          "",
          "1. Open Lens Studio and start from the Body Morph or Hand Tracking template.",
          "2. Import everything in /textures as Texture resources.",
          "3. Set the tattoo material blend mode to Multiply so the ink sits in the skin.",
          "4. Wire a picker UI using manifest.json for names and order.",
          "5. Submit in My Lenses and link inksimulator.com in the description.",
        ].join("\n"),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "inksimulator-lens-pack.zip");
      toast.success(`Lens pack ready — ${manifest.length} designs included.`);
    } catch {
      toast.error("Could not build the Lens pack. Try again.");
    } finally {
      setPacking(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-6">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-accent/12 ring-1 ring-accent/25">
            <Ghost className="size-5 text-accent" />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-tight">Snapchat filter</h1>
            <p className="text-[12px] text-muted-foreground">
              Try an InkSimulator design inside Snapchat and share the snap.
            </p>
          </div>
        </header>

        <section className="mt-6">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            1. Pick a design
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {TATTOOS.slice(0, 16).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                aria-pressed={t.id === selected}
                className={`aspect-square rounded-xl bg-artwork p-2 transition ${
                  t.id === selected
                    ? "ring-2 ring-accent"
                    : "ring-1 ring-white/10 hover:ring-white/25"
                }`}
              >
                <img
                  src={t.src}
                  alt={t.name}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            2. Send it to Snapchat
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run("save")}
              disabled={busy !== null}
              className="flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-bold text-ink disabled:opacity-50"
            >
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Save sticker to camera roll
            </button>
            <button
              type="button"
              onClick={() => void run("download")}
              disabled={busy !== null}
              className="flex h-11 items-center gap-2 rounded-xl border border-white/12 px-4 text-[13px] font-bold disabled:opacity-50"
            >
              <Download className="size-4" />
              Download PNG
            </button>
            <a
              href="https://www.snapchat.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center gap-2 rounded-xl border border-white/12 px-4 text-[13px] font-bold"
            >
              Open Snapchat
            </a>
            <button
              type="button"
              onClick={() =>
                void shareLink(
                  "https://www.inksimulator.com/snapchat",
                  "Try this tattoo on your skin in Snapchat with InkSimulator",
                )
              }
              className="flex h-11 items-center gap-2 rounded-xl border border-white/12 px-4 text-[13px] font-bold"
            >
              <Share2 className="size-4" />
              Share
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            Snapchat doesn't let websites post for you. Save the transparent
            sticker, then in Snapchat tap the camera, choose the scissors/sticker
            icon and place it on your skin — pinch to size it and send the snap.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-accent">
            For creators — publish it as a Lens
          </h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12px] text-muted-foreground">
            <li>Download the sticker PNGs above — they are transparent and 1024×1024.</li>
            <li>
              In Lens Studio, start from the Body Morph or Hand Tracking template and
              import the PNGs as textures.
            </li>
            <li>Add a picker so users can swap designs, and keep skin blend mode on Multiply.</li>
            <li>Submit the Lens in My Lenses and link back to inksimulator.com in the description.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void buildLensPack()}
              disabled={packing}
              className="flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-bold text-ink disabled:opacity-50"
            >
              {packing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Package className="size-4" />
              )}
              Download Lens asset pack (.zip)
            </button>
            <a
              href="https://ar.snap.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center gap-2 rounded-xl border border-white/12 px-4 text-[13px] font-bold"
            >
              Open Lens Studio
            </a>
          </div>
        </section>

        <p className="mt-6 text-[12px] text-muted-foreground">
          Want the full AR try-on with real cm sizing?{" "}
          <Link to="/ar" className="font-bold text-accent underline">
            Open the camera
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
