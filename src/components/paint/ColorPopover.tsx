import { useEffect, useState, useSyncExternalStore } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorWheel } from "./ColorWheel";
import { hexToRgb, rgbCss, rgbToHex } from "@/lib/paint/color";
import {
  addColorToPalette,
  clearColorHistory,
  createPalette,
  listPalettes,
  loadColorHistory,
  removeColorFromPalette,
  removePalette,
  subscribePalettes,
  type Palette,
} from "@/lib/paint/palettes";
import type { RGB } from "@/lib/paint/types";

interface Store {
  history: RGB[];
  palettes: Palette[];
}

let snapshot: Store = { history: [], palettes: [] };

/** One cached snapshot, so useSyncExternalStore sees a stable object. */
function readStore(): Store {
  const history = loadColorHistory();
  const palettes = listPalettes();
  if (
    history.length !== snapshot.history.length ||
    palettes.length !== snapshot.palettes.length ||
    history.some((c, i) => { const previous = snapshot.history[i]; return !previous || rgbToHex(c) !== rgbToHex(previous); }) ||
    palettes.some((p, i) => p.colors.length !== snapshot.palettes[i]?.colors.length)
  ) {
    snapshot = { history, palettes };
  }
  return snapshot;
}

function Swatch({
  color,
  onPick,
  onRemove,
}: {
  color: RGB;
  onPick: () => void;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5"><button
      type="button"
      aria-label={rgbToHex(color)}
      onClick={onPick}
      onContextMenu={(e) => {
        if (!onRemove) return;
        e.preventDefault();
        onRemove();
      }}
      className="size-6 rounded-full border border-panel-border ring-1 ring-inset ring-black/30 transition-transform hover:scale-110"
      style={{ backgroundColor: rgbCss(color) }}
    />{onRemove && <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove ${rgbToHex(color)}`} onClick={onRemove}><Trash2 /></Button>}</span>
  );
}

export function ColorPopover({
  color,
  onChange,
  inline = false,
}: {
  inline?: boolean;
  color: RGB;
  onChange: (color: RGB) => void;
}) {
  const [hex, setHex] = useState(rgbToHex(color));
  const { history, palettes } = useSyncExternalStore(subscribePalettes, readStore, readStore);

  useEffect(() => {
    setHex(rgbToHex(color));
  }, [color]);

  const body = (<>
        <ColorWheel color={color} onChange={onChange} />

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">HEX</span>
          <Input
            value={hex}
            spellCheck={false}
            onChange={(e) => {
              setHex(e.target.value);
              const rgb = hexToRgb(e.target.value);
              if (rgb) onChange(rgb);
            }}
            className="h-8 font-mono text-xs"
          />
        </div>

        {history.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Recent</p>
              <button
                type="button"
                onClick={() => clearColorHistory()}
                className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((c, i) => (
                <Swatch key={`${rgbToHex(c)}-${i}`} color={c} onPick={() => onChange(c)} />
              ))}
            </div>
          </div>
        )}

        {/* Saved palettes: curated sets the artist reuses between sketches. */}
        <div className="mt-4 space-y-2 border-t border-panel-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Palettes</p>
            <button
              type="button"
              onClick={() => createPalette(`Palette ${palettes.length + 1}`, [color])}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/15"
            >
              <Plus size={12} /> New
            </button>
          </div>

          {palettes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Create a palette for e.g. skin tones or grayscales.
            </p>
          ) : (
            palettes.map((p) => (
              <div key={p.id} className="rounded-lg bg-secondary/40 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="truncate text-[11px] text-foreground/80">{p.name}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Add color to ${p.name}`}
                      onClick={() => addColorToPalette(p.id, color)}
                      className="flex size-6 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => removePalette(p.id)}
                      className="flex size-6 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.colors.map((c, i) => (
                    <Swatch
                      key={`${rgbToHex(c)}-${i}`}
                      color={c}
                      onPick={() => onChange(c)}
                      onRemove={() => removeColorFromPalette(p.id, i)}
                    />
                  ))}
                  {p.colors.length === 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Press + to add the current color
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
  </>);
  if (inline) return <div>{body}</div>;

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Color"
        className="size-9 rounded-full border-2 border-panel-border shadow-float ring-1 ring-inset ring-black/40 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        style={{ backgroundColor: rgbCss(color) }}
      />
      <PopoverContent
        align="end"
        sideOffset={10}
        className="max-h-[80vh] w-60 overflow-y-auto border-panel-border bg-panel/95 backdrop-blur-xl"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}
