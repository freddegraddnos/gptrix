import { X } from "lucide-react";

/**
 * Lightweight full-screen preview for flat deliverables (1:1 SVG stencils and
 * measurement images), so a booking file can be verified before downloading.
 */
export function FilePreviewSheet({
  src,
  name,
  caption,
  onClose,
}: {
  src: string;
  name: string;
  caption?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4 backdrop-blur"
      role="dialog"
      aria-label={`Preview of ${name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="grid size-8 place-items-center rounded-lg border border-white/10 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-2 grid max-h-[65vh] place-items-center overflow-auto rounded-xl bg-white p-3">
          <img src={src} alt={name} className="max-h-[60vh] w-auto max-w-full object-contain" />
        </div>
        {caption && <p className="mt-2 text-[11px] text-muted-foreground">{caption}</p>}
      </div>
    </div>
  );
}
