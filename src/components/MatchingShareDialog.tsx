/**
 * "Matching tattoos" — send the current design to a partner or friend so they
 * open the exact same motif in AR, optionally at the exact same size.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, HeartHandshake, Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { createMatchingDesign } from "@/lib/matching.functions";
import { copyToClipboard, shareLink, socialLinkTargets } from "@/lib/share";

/** Any src (imported asset, blob URL, data URL) → PNG data URL. */
async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read the design"));
    el.src = src;
  });
  const canvas = document.createElement("canvas");
  const max = 1024;
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read the design");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function MatchingShareDialog({
  open,
  onClose,
  src,
  name,
  widthCm,
  rotation,
}: {
  open: boolean;
  onClose: () => void;
  /** Image to send — library motif, sketch, text or AI design. */
  src: string;
  name: string;
  /** Current on-skin width in cm. */
  widthCm: number;
  rotation?: number;
}) {
  const [sameSize, setSameSize] = useState(true);
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setLink(null);
      setCopied(false);
      setBusy(false);
    }
  }, [open]);

  const shareText = useMemo(
    () => `Wanna get matching ink? I picked "${name}" in InkSimulator — try it on your skin`,
    [name],
  );
  const targets = link ? socialLinkTargets(link, shareText) : [];

  if (!open) return null;

  const create = async () => {
    setBusy(true);
    try {
      const image = await toDataUrl(src);
      const { token } = await createMatchingDesign({
        data: {
          name,
          image,
          widthCm: sameSize ? Number(widthCm.toFixed(1)) : null,
          rotation: sameSize && typeof rotation === "number" ? Math.round(rotation) : null,
          message: message.trim() || null,
          senderName: senderName.trim() || null,
        },
      });
      setLink(`${window.location.origin}/m/${token}`);
    } catch {
      toast.error("Could not create the matching link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-ink/95 backdrop-blur-xl overflow-y-auto p-6 pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-mono-caps text-[10px] text-accent">Matching tattoos</p>
          <h3 className="font-display text-2xl">Send to your partner or friend</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            They get the exact same design in AR — sketches, text and AI designs included.
          </p>
        </div>
        <button
          onClick={onClose}
          className="size-10 rounded-full glass grid place-items-center shrink-0"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate/40 p-3">
        <div className="size-16 rounded-xl bg-white/5 grid place-items-center overflow-hidden shrink-0">
          <img src={src} alt={name} className="max-h-14 max-w-14 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {widthCm.toFixed(1)} cm wide
          </p>
        </div>
      </div>

      {!link && (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate/40 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sameSize}
              onChange={(e) => setSameSize(e.target.checked)}
              className="mt-0.5 size-4 accent-[color:var(--color-accent,#8A5BF2)]"
            />
            <span className="text-[12px]">
              <span className="font-bold">Share the same size too</span>
              <span className="block text-[11px] text-muted-foreground">
                Opens at {widthCm.toFixed(1)} cm and the same angle, so your tattoos match.
              </span>
            </span>
          </label>

          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Your name (optional)"
            maxLength={60}
            className="w-full h-11 rounded-xl border border-white/10 bg-slate/40 px-3 text-[13px] outline-none focus:border-accent/60"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message (optional) — e.g. one on each wrist?"
            maxLength={280}
            rows={2}
            className="w-full rounded-xl border border-white/10 bg-slate/40 p-3 text-[13px] outline-none focus:border-accent/60"
          />

          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="w-full h-12 rounded-full bg-accent text-ink text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <HeartHandshake className="size-4" />
            )}
            {busy ? "Creating link…" : "Create matching link"}
          </button>
        </div>
      )}

      {link && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-accent/30 bg-accent/10 p-3">
            <p className="text-[12px] font-bold text-accent">Matching link ready</p>
            <p className="mt-1 break-all text-[11px] text-muted-foreground">{link}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {sameSize
                ? `They open the same design at ${widthCm.toFixed(1)} cm.`
                : "They open the same design and pick their own size."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void shareLink(link, shareText)}
              className="px-4 py-2.5 rounded-lg bg-accent text-ink text-[11px] font-bold flex items-center gap-1.5"
            >
              <Share2 className="size-3" /> Share
            </button>
            <button
              onClick={async () => {
                const ok = await copyToClipboard(link);
                setCopied(ok);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-slate text-[11px] font-bold flex items-center gap-1.5"
            >
              {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            {targets
              .filter((t) => t.href)
              .map((t) => (
                <a
                  key={t.id}
                  href={t.href!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-lg border border-white/10 bg-slate text-[11px] font-bold"
                >
                  {t.label}
                </a>
              ))}
          </div>

          <a
            href="/couples"
            className="block rounded-2xl border border-white/10 bg-slate/40 p-3 text-[11px] text-muted-foreground"
          >
            <span className="font-bold text-foreground">Keep them together →</span> Create a couple
            profile and save every matching design in one shared place.
          </a>
        </div>
      )}

    </div>
  );
}
