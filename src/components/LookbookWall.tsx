import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Camera,
  X,
  Trash2,
  Share2,
  Download,
  Ruler,
  Printer,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { BookmarkStar } from "@/components/BookmarkStar";
import { PrintExportDialog } from "@/components/PrintExportDialog";
import { dataUrlToBlob, downloadBlob, shareFile } from "@/lib/share";

import { tx, useUiLang } from "@/lib/uiLang";
const KEY = "inkvision.placements.v1";

type Placement = {
  id: string;
  motifId?: string;
  name?: string;
  still?: string;
  src?: string;
  widthCm?: number;
  favorite?: boolean;
  savedAt?: number;
};

function readPlacements(): Placement[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Placement[];
    return Array.isArray(list) ? list.filter((p) => p && (p.still || p.src)) : [];
  } catch {
    return [];
  }
}

function writePlacements(list: Placement[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked — the view still updates */
  }
}

const fileName = (p: Placement) =>
  `inksimulator-${(p.name ?? "tryon").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

/**
 * Lookbook wall — a wall of your own try-ons, not an empty list.
 * Open one to share it, download it, star it or re-size it before it goes to
 * an artist — no trip back through the AR camera required.
 */
export function LookbookWall() {
  useUiLang();
  const [items, setItems] = useState<Placement[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [busy, setBusy] = useState<null | "share" | "download">(null);
  const [editing, setEditing] = useState(false);
  const [draftCm, setDraftCm] = useState(10);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    setItems(readPlacements());
  }, []);

  const open = useMemo(
    () => items?.find((p) => p.id === openId) ?? null,
    [items, openId],
  );

  const shown = useMemo(
    () => (items ?? []).filter((p) => (favOnly ? p.favorite : true)),
    [items, favOnly],
  );

  const update = (id: string, patch: Partial<Placement>) => {
    const next = readPlacements().map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    );
    writePlacements(next);
    setItems(next);
  };

  const remove = (id: string) => {
    const next = readPlacements().filter((p) => p.id !== id);
    writePlacements(next);
    setItems(next);
    setOpenId(null);
  };

  const openItem = (p: Placement) => {
    setOpenId(p.id);
    setEditing(false);
    setDraftCm(typeof p.widthCm === "number" ? p.widthCm : 10);
  };

  const withBlob = async (p: Placement) => {
    const url = p.still || p.src || "";
    if (url.startsWith("data:")) return dataUrlToBlob(url);
    const res = await fetch(url);
    return res.blob();
  };

  const doShare = async (p: Placement) => {
    setBusy("share");
    try {
      const blob = await withBlob(p);
      const out = await shareFile(blob, fileName(p), {
        text: `${p.name ?? "My try-on"}${
          typeof p.widthCm === "number" ? ` · ${p.widthCm.toFixed(1)} cm` : ""
        } — InkSimulator`,
      });
      if (out === "downloaded") toast.success(tx("Saved to your device"));
    } catch {
      toast.error(tx("Could not share this try-on"));
    } finally {
      setBusy(null);
    }
  };

  const doDownload = async (p: Placement) => {
    setBusy("download");
    try {
      downloadBlob(await withBlob(p), fileName(p));
      toast.success(tx("Downloaded"));
    } catch {
      toast.error(tx("Could not download this try-on"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-6" aria-label={tx("Lookbook")}>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-mono-caps text-[10px] text-accent">{tx("Lookbook")}</div>
          <h2 className="font-display text-lg font-bold leading-tight">
            {tx("Your try-ons")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            aria-pressed={favOnly}
            className={`h-9 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 ${
              favOnly
                ? "border-amber-300/60 bg-amber-300/10 text-amber-300"
                : "border-white/10 text-foreground/80"
            }`}
          >
            {favOnly && <span aria-hidden="true">✓</span>}
            {tx("Favorites")}
          </button>
          <Link
            to="/ar"
            className="h-9 px-3 rounded-xl border border-white/10 text-[13px] font-medium inline-flex items-center gap-1.5"
          >
            <Camera className="size-3.5" />
            {tx("New")}
          </Link>
        </div>
      </div>

      {items === null ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-lg bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : shown.length === 0 ? (
        favOnly ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate p-6 text-center">
            <div className="font-display font-bold">{tx("No favorites yet")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {tx("Tap the star on a try-on to collect your best ones here.")}
            </p>
          </div>
        ) : (
          <Link
            to="/ar"
            className="block rounded-2xl border border-dashed border-white/15 bg-slate p-6 text-center"
          >
            <Camera className="size-6 mx-auto text-accent" />
            <div className="mt-2 font-display font-bold">{tx("No try-ons yet")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {tx("Lock a design on your skin and save it — it lands here.")}
            </p>
          </Link>
        )
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {shown.map((p) => (
            <div key={p.id} className="relative">
              <BookmarkStar
                active={!!p.favorite}
                label={p.name ?? "try-on"}
                onToggle={() => update(p.id, { favorite: !p.favorite })}
              />
              <button
                onClick={() => openItem(p)}
                className="relative block aspect-[3/4] w-full rounded-lg overflow-hidden bg-ink border border-white/10 text-left"
                aria-label={`Open ${p.name ?? "try-on"}`}
              >
                <img
                  src={p.still || p.src || ""}
                  alt={p.name ?? tx("Saved try-on")}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
                {typeof p.widthCm === "number" && (
                  <span className="absolute bottom-1 left-1 right-1 truncate text-[10px] tabular-nums text-white/90 drop-shadow">
                    {p.widthCm.toFixed(1)} cm
                    {p.name ? ` · ${p.name}` : ""}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <div className="font-display font-bold truncate">
                {open.name ?? tx("Try-on")}
              </div>
              {typeof open.widthCm === "number" && (
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {open.widthCm.toFixed(1)} cm
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => remove(open.id)}
                className="size-10 rounded-full glass grid place-items-center"
                aria-label={tx("Delete try-on")}
              >
                <Trash2 className="size-4" />
              </button>
              <button
                onClick={() => setOpenId(null)}
                className="size-10 rounded-full glass grid place-items-center"
                aria-label={tx("Close preview")}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-3 pt-0">
            <img
              src={open.still || open.src || ""}
              alt={open.name ?? tx("Saved try-on")}
              className="size-full object-contain rounded-xl"
            />
          </div>

          <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-3 border-t border-white/10">
            {editing && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-mono-caps text-[10px] text-accent">
                    {tx("Adjust size")}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {draftCm.toFixed(1)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={40}
                  step={0.1}
                  value={draftCm}
                  onChange={(e) => setDraftCm(Number(e.target.value))}
                  aria-label={tx("Tattoo width in centimetres")}
                  className="w-full accent-accent"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="flex-1 min-h-11 rounded-xl border border-white/15 text-xs font-bold"
                  >
                    {tx("Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      update(open.id, { widthCm: Number(draftCm.toFixed(1)) });
                      setEditing(false);
                      toast.success(tx("Size updated"));
                    }}
                    className="flex-1 min-h-11 rounded-xl bg-accent text-ink text-xs font-bold"
                  >
                    {tx("Save size")}
                  </button>
                </div>
                <Link
                  to="/ar"
                  search={{
                    ...(open.motifId ? { motif: open.motifId } : {}),
                    w: String(draftCm),
                  }}
                  className="block text-center text-[11px] text-muted-foreground underline"
                >
                  {tx("Re-calibrate on skin in AR")}
                </Link>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => void doShare(open)}
                disabled={busy !== null}
                className="min-h-12 rounded-xl bg-accent text-ink text-[11px] font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-60"
              >
                {busy === "share" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Share2 className="size-4" />
                )}
                {tx("Share")}
              </button>
              <button
                type="button"
                onClick={() => void doDownload(open)}
                disabled={busy !== null}
                className="min-h-12 rounded-xl border border-white/15 text-[11px] font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-60"
              >
                {busy === "download" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {tx("Save")}
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
                className="min-h-12 rounded-xl border border-white/15 text-[11px] font-bold flex flex-col items-center justify-center gap-1"
              >
                <Ruler className="size-4" />
                {tx("Size")}
              </button>
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className="min-h-12 rounded-xl border border-white/15 text-[11px] font-bold flex flex-col items-center justify-center gap-1"
              >
                <Printer className="size-4" />
                {tx("Artist")}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && printOpen && (
        <PrintExportDialog
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          sources={[
            {
              url: open.src || open.still || "",
              label: open.name ?? "Design",
            },
          ]}
          title={open.name ?? tx("InkSimulator design")}
          photoUrl={open.still ?? null}
          defaultWidthCm={open.widthCm ?? 10}
        />
      )}
    </section>
  );
}
