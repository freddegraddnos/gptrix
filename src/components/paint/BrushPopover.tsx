import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  BRUSHES,
  BRUSH_ORDER,
  DOTWORK_DENSITY_MAX,
  DOTWORK_DENSITY_MIN,
  getDotworkDensity,
  setDotworkDensity,
} from "@/lib/paint/brushes";
import {
  BUILTIN_PRESETS,
  duplicateBrushPreset,
  listBrushPresets,
  removeBrushPreset,
  saveBrushPreset,
  subscribeBrushPresets,
  type BrushPreset,
} from "@/lib/paint/brushLibrary";
import type { FeelSettings, PressureCurve } from "@/lib/paint/feel";
import type { BrushId } from "@/lib/paint/types";

const CURVES: { id: PressureCurve; label: string }[] = [
  { id: "soft", label: "Soft" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
];

/** Presets are shared app state living outside React, so subscribe to them. */
function usePresets(): BrushPreset[] {
  return useSyncExternalStore(subscribeBrushPresets, listBrushPresets, listBrushPresets);
}

export function BrushPopoverBody({
  brushId,
  size,
  opacity,
  feel,
  showBrushList,
  onBrushChange,
  onSizeChange,
  onOpacityChange,
  onFeelChange,
  onApplyPreset,
}: {
  brushId: BrushId;
  size: number;
  opacity: number;
  feel: FeelSettings;
  showBrushList: boolean;
  onBrushChange: (id: BrushId) => void;
  onSizeChange: (size: number) => void;
  onOpacityChange: (opacity: number) => void;
  onFeelChange: (feel: Partial<FeelSettings>) => void;
  onApplyPreset?: (preset: BrushPreset) => void;
}) {
  const presets = usePresets();
  const [dotDensity, setDotDensity] = useState(() => getDotworkDensity());
  const [name, setName] = useState("");
  const [naming, setNaming] = useState(false);

  useEffect(() => {
    if (!naming) setName("");
  }, [naming]);

  const save = () => {
    saveBrushPreset({
      name: name.trim() || `${BRUSHES[brushId].label} ${Math.round(size)}px`,
      brushId,
      size,
      opacity,
      feel,
    });
    setNaming(false);
  };

  return (
    <div className="space-y-4">
      {showBrushList && (
        <div className="grid gap-1">
          {BRUSH_ORDER.filter((id) => id !== "eraser").map((id) => (
            <button
              key={id}
              onClick={() => onBrushChange(id)}
              className={`rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                brushId === id
                  ? "bg-primary/15 text-primary"
                  : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {BRUSHES[id].label}
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Size</span>
          <span className="font-mono text-xs text-foreground/70">{Math.round(size)} px</span>
        </div>
        <Slider
          min={1}
          max={200}
          step={1}
          value={[size]}
          onValueChange={([v]) => onSizeChange(v ?? size)}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Opacity</span>
          <span className="font-mono text-xs text-foreground/70">{Math.round(opacity * 100)}%</span>
        </div>
        <Slider
          min={1}
          max={100}
          step={1}
          value={[Math.round(opacity * 100)]}
          onValueChange={([v]) => onOpacityChange((v ?? 100) / 100)}
        />
      </div>

      {/* Dotwork is a stipple brush: density sets how tightly the dots sit. */}
      {brushId === "dotwork" && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Dot density</span>
            <span className="font-mono text-xs text-foreground/70">{Math.round(dotDensity)}%</span>
          </div>
          <Slider
            min={DOTWORK_DENSITY_MIN}
            max={DOTWORK_DENSITY_MAX}
            step={1}
            value={[dotDensity]}
            onValueChange={([v]) => {
              const next = v ?? dotDensity;
              setDotworkDensity(next);
              setDotDensity(next);
            }}
            aria-label="Dot density for dotwork"
          />
        </div>
      )}

      <div className="space-y-3 border-t border-panel-border pt-3">
        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">Pressure curve</span>
          <div className="grid grid-cols-3 gap-1">
            {CURVES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={feel.curve === c.id}
                onClick={() => onFeelChange({ curve: c.id })}
                className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                  feel.curve === c.id
                    ? "bg-primary/15 text-primary"
                    : "text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Stabilization</span>
            <span className="font-mono text-xs text-foreground/70">
              {Math.round(feel.streamline * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={95}
            step={1}
            value={[Math.round(feel.streamline * 100)]}
            onValueChange={([v]) => onFeelChange({ streamline: (v ?? 0) / 100 })}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Taper</span>
            <span className="font-mono text-xs text-foreground/70">
              {Math.round(feel.taper * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[Math.round(feel.taper * 100)]}
            onValueChange={([v]) => onFeelChange({ taper: (v ?? 0) / 100 })}
          />
        </div>

        <label className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pressure controls width</span>
          <Switch
            checked={feel.sizeFromPressure}
            onCheckedChange={(v) => onFeelChange({ sizeFromPressure: v })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pressure controls opacity</span>
          <Switch
            checked={feel.opacityFromPressure}
            onCheckedChange={(v) => onFeelChange({ opacityFromPressure: v })}
          />
        </label>
      </div>

      {/* Ready-made presets. Applying loads the settings; duplicate copies it
          into "My brushes" so it can be tweaked and saved freely. */}
      <div className="space-y-2 border-t border-panel-border pt-3">
        <span className="block text-xs text-muted-foreground">Presets</span>
        <ul className="space-y-1">
          {BUILTIN_PRESETS.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onApplyPreset?.(p)}
                className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {p.name}
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                  {Math.round(p.size)}px
                </span>
              </button>
              <button
                type="button"
                aria-label={`Duplicate ${p.name}`}
                onClick={() => duplicateBrushPreset(p.id)}
                className="flex size-7 items-center justify-center rounded-md text-foreground/55 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Copy size={13} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Brush library: the current settings, saved under a name. */}
      <div className="space-y-2 border-t border-panel-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">My brushes</span>
          <button
            type="button"
            aria-label="Save brush"
            onClick={() => (naming ? save() : setNaming(true))}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-primary transition-colors hover:bg-primary/15"
          >
            <Plus size={13} /> {naming ? "Save" : "Save"}
          </button>
        </div>

        {naming && (
          <Input
            autoFocus
            value={name}
            placeholder="Brush name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setNaming(false);
            }}
            className="h-8 text-xs"
          />
        )}

        {presets.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No saved brushes yet — set size, opacity and feel, then save.
          </p>
        ) : (
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onApplyPreset?.(p)}
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {p.name}
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    {Math.round(p.size)}px
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Duplicate ${p.name}`}
                  onClick={() => duplicateBrushPreset(p.id)}
                  className="flex size-7 items-center justify-center rounded-md text-foreground/55 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => removeBrushPreset(p.id)}
                  className="flex size-7 items-center justify-center rounded-md text-foreground/55 transition-colors hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
