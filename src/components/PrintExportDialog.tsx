import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileDown,
  FlipHorizontal,
  ImageDown,
  Loader2,
  Printer,
  Send,
  X,
} from "lucide-react";
import {
  PAPERS,
  buildPrintSheetPdf,
  downloadBlob,
  downloadPrintSheetPng,
  renderPrintSheet,
  type PaperId,
  type PrintSheetOptions,
} from "@/lib/printExport";


type Source = { url: string; label: string };

export function PrintExportDialog({
  open,
  onClose,
  sources,
  title,
  bodyPart,
  note,
  photoUrl,
  defaultWidthCm,
}: {
  open: boolean;
  onClose: () => void;
  sources: Source[];
  title: string;
  bodyPart?: string | null;
  note?: string | null;
  photoUrl?: string | null;
  defaultWidthCm?: number | null;
}) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [widthCm, setWidthCm] = useState(defaultWidthCm ?? 10);
  const [paper, setPaper] = useState<PaperId>("a4");
  const [orientation, setOrientation] = useState<
    "auto" | "portrait" | "landscape"
  >("auto");
  const [mirror, setMirror] = useState(false);
  const [stencil, setStencil] = useState(false);
  const [busy, setBusy] = useState<null | "png" | "pdf" | "send">(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    h: number;
    fits: boolean;
    orientation: "portrait" | "landscape";
  } | null>(null);
  const holder = useRef<HTMLDivElement>(null);

  const source = sources[srcIndex];

  const options: PrintSheetOptions | null = useMemo(
    () =>
      source
        ? {
            imageUrl: source.url,
            widthCm,
            paper,
            orientation,
            mirror,
            stencil,
            title,
            bodyPart,
            note,
            photoUrl,
          }
        : null,
    [
      source,
      widthCm,
      paper,
      orientation,
      mirror,
      stencil,
      title,
      bodyPart,
      note,
      photoUrl,
    ],
  );

  useEffect(() => {
    if (!open || !options) return;
    let cancelled = false;
    setRendering(true);
    setError(null);
    const t = setTimeout(() => {
      renderPrintSheet({ ...options, dpi: 96 })
        .then((res) => {
          if (cancelled || !holder.current) return;
          res.canvas.className = "w-full h-auto rounded-lg";
          holder.current.replaceChildren(res.canvas);
          setMeta({
            h: res.heightCm,
            fits: res.fits,
            orientation: res.orientation,
          });
        })
        .catch(() => !cancelled && setError("Could not load that image."))
        .finally(() => !cancelled && setRendering(false));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, options]);

  if (!open) return null;

  const sizeLine = (w: number, h: number) =>
    `${w.toFixed(1)} × ${h.toFixed(1)} cm (${Math.round(w * 10)} × ${Math.round(
      h * 10,
    )} mm)`;

  const run = async (kind: "png" | "pdf" | "send") => {
    if (!options) return;
    setBusy(kind);
    setError(null);
    setStatus(null);
    try {
      if (kind === "png") {
        await downloadPrintSheetPng(options);
        setStatus("PNG sheet downloaded to your device.");
        setBusy(null);
        return;
      }

      const sheet = await buildPrintSheetPdf(options);
      const size = sizeLine(sheet.widthCm, sheet.heightCm);

      if (kind === "pdf") {
        downloadBlob(sheet.blob, sheet.fileName);
        setStatus(
          `PDF downloaded — ${size}, ${sheet.orientation}, 1:1 print area.`,
        );
        setBusy(null);
        return;
      }

      const file = new File([sheet.blob], sheet.fileName, {
        type: "application/pdf",
      });
      const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShare) {
        try {
          await navigator.share({
            files: [file],
            title: title || "Tattoo stencil",
            text: `${title || "Tattoo"} — ${size}${
              bodyPart ? ` · ${bodyPart}` : ""
            }. Printed at 1:1, includes the placement photo.`,
          });
          setStatus(`Sent to your artist — ${size}, PDF with placement photo.`);
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") {
            setStatus("Sending cancelled — nothing was sent.");
          } else {
            downloadBlob(sheet.blob, sheet.fileName);
            setStatus(
              `Share sheet unavailable — PDF downloaded instead (${size}). Attach it in your message to the artist.`,
            );
          }
        }
      } else {
        downloadBlob(sheet.blob, sheet.fileName);
        setStatus(
          `PDF ready and downloaded (${size}) — attach it in your message to the artist.`,
        );
      }
    } catch {
      setError("Export failed. Try another image.");
    } finally {
      setBusy(null);
    }
  };


  return (
    <div className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-sm overflow-y-auto">
      <div className="mx-auto max-w-md p-4 pb-24">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-accent" />
            <h2 className="font-display font-bold text-lg">Print-ready export</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="size-9 rounded-full border border-white/15 grid place-items-center"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          1:1 sheet: motif at measured size, print frame, cm ruler, 1:1 check square and your locked placement photo.
        </p>

        {sources.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
            {sources.map((s, i) => (
              <button
                key={s.url + i}
                onClick={() => setSrcIndex(i)}
                aria-pressed={i === srcIndex}
                className={`flex-none size-14 rounded-lg overflow-hidden border-2 ${
                  i === srcIndex ? "border-accent" : "border-white/10"
                }`}
              >
                <img
                  src={s.url}
                  alt={s.label}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-white/10 bg-white p-2">
          <div ref={holder} className="min-h-[240px] grid place-items-center">
            {rendering && <Loader2 className="size-5 animate-spin text-ink/40" />}
          </div>
        </div>

        {error && (
          <p className="mt-2 text-[11px] text-destructive">{error}</p>
        )}
        {meta && !meta.fits && !error && (
          <p className="mt-2 text-[11px] text-destructive">
            Larger than the printable area — the sheet is scaled down. Print on a
            bigger sheet or reduce the width for a true 1:1 print.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="flex items-center justify-between text-mono-caps text-[10px] text-muted-foreground">
              Width
              <span className="text-accent font-bold">
                {widthCm.toFixed(1)} cm
                {meta ? ` × ${meta.h.toFixed(1)} cm` : ""}
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={40}
              step={0.5}
              value={widthCm}
              onChange={(e) => setWidthCm(Number(e.target.value))}
              className="mt-2 w-full accent-accent"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            {PAPERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPaper(p.id)}
                aria-pressed={paper === p.id}
                className={`h-10 rounded-xl border text-[11px] font-bold ${
                  paper === p.id
                    ? "border-accent bg-accent text-ink"
                    : "border-white/15 text-foreground/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["auto", "portrait", "landscape"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOrientation(o)}
                aria-pressed={orientation === o}
                className={`h-10 rounded-xl border text-[11px] font-bold capitalize ${
                  orientation === o
                    ? "border-accent bg-accent text-ink"
                    : "border-white/15 text-foreground/80"
                }`}
              >
                {o}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMirror((v) => !v)}
              aria-pressed={mirror}
              className={`h-10 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 ${
                mirror
                  ? "border-accent bg-accent text-ink"
                  : "border-white/15 text-foreground/80"
              }`}
            >
              <FlipHorizontal className="size-3.5" /> Mirror
            </button>
            <button
              onClick={() => setStencil((v) => !v)}
              aria-pressed={stencil}
              className={`h-10 rounded-xl border text-[11px] font-bold ${
                stencil
                  ? "border-accent bg-accent text-ink"
                  : "border-white/15 text-foreground/80"
              }`}
            >
              Stencil lines
            </button>
          </div>
        </div>

        <button
          onClick={() => run("send")}
          disabled={busy !== null || !source}
          className="mt-4 w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === "send" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Send to artist
        </button>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Sends the 1:1 PDF with{" "}
          {photoUrl ? "your locked placement photo, " : ""}exact cm/mm
          measurements and the print frame.
        </p>

        {status && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3">
            <Check className="size-4 text-accent mt-0.5 shrink-0" />
            <p className="text-[11px] leading-snug">{status}</p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => run("pdf")}
            disabled={busy !== null || !source}
            className="h-11 rounded-xl border border-white/15 bg-slate font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy === "pdf" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            Download PDF
          </button>
          <button
            onClick={() => run("png")}
            disabled={busy !== null || !source}
            className="h-11 rounded-xl border border-white/15 bg-slate font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy === "png" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageDown className="size-4" />
            )}
            PNG
          </button>
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          Print at 100% (no "fit to page"). Verify with the 10 cm bar on the
          sheet.
        </p>
      </div>
    </div>
  );
}
