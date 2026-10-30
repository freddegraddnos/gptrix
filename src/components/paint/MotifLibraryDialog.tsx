import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TATTOOS, TYPES, type TattooType } from "@/lib/tattoos";

/**
 * Motif library inside the drawing studio: search or filter the InkSimulator
 * catalogue and drop a motif straight onto the canvas as an editable layer,
 * ready to be drawn over, recoloured or combined with text.
 */
export function MotifLibraryDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (motif: { src: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TattooType | "All">("All");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TATTOOS.filter((t) => {
      if (type !== "All" && t.type !== type) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.style.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q)
      );
    });
  }, [query, type]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col border-panel-border bg-panel/97 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Add a motif</DialogTitle>
          <DialogDescription className="text-xs">
            Pick a design from the library — it lands as an editable layer you
            can draw on, resize and combine with your own text.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-xl border border-panel-border px-3">
          <Search size={15} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search motifs — snake, rose, mandala…"
            aria-label="Search motifs"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {(["All", ...TYPES] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t as TattooType | "All")}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors ${
                type === t
                  ? "bg-primary text-primary-foreground"
                  : "border border-panel-border text-foreground/70 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
          {results.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick({ src: t.src, name: t.name })}
              className="group flex flex-col items-center gap-1 rounded-xl border border-panel-border p-2 transition-colors hover:bg-accent"
            >
              <img
                src={t.src}
                alt={t.name}
                loading="lazy"
                className="h-20 w-full rounded-lg bg-artwork object-contain p-1"
              />
              <span className="line-clamp-1 text-[10px] text-foreground/75">{t.name}</span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
              No motifs match that search.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
