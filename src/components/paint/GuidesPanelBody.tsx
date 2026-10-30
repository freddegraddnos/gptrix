import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SYMMETRY_LABELS, type GuideSettings, type SymmetryMode } from "@/lib/paint/guides";

const MODES: SymmetryMode[] = ["off", "vertical", "horizontal", "quad", "radial"];

/**
 * Drawing guide: a millimetre grid and symmetry painting.
 *
 * The grid pitch is stated in millimetres rather than pixels, so it stays a real
 * measurement whatever resolution the document was created at.
 */
export function GuidesPanelBody({
  guides,
  onChange,
  onResetRotation,
  rotationDeg,
}: {
  guides: GuideSettings;
  onChange: (patch: Partial<GuideSettings>) => void;
  onResetRotation: () => void;
  rotationDeg: number;
}) {
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Grid</span>
        <Switch checked={guides.grid} onCheckedChange={(v) => onChange({ grid: v })} />
      </label>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Grid size</span>
          <span className="font-mono text-xs text-foreground/70">{guides.gridMm} mm</span>
        </div>
        <Slider
          min={1}
          max={50}
          step={1}
          value={[guides.gridMm]}
          onValueChange={([v]) => onChange({ gridMm: v ?? 10 })}
        />
      </div>

      <div className="border-t border-panel-border pt-3">
        <span className="mb-1.5 block text-xs text-muted-foreground">Symmetry</span>
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={guides.symmetry === m}
              onClick={() => onChange({ symmetry: m })}
              className={`rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                guides.symmetry === m
                  ? "bg-primary/15 text-primary"
                  : "text-foreground/70 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {SYMMETRY_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {guides.symmetry === "radial" && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Segments</span>
            <span className="font-mono text-xs text-foreground/70">{guides.radialSegments}</span>
          </div>
          <Slider
            min={2}
            max={24}
            step={1}
            value={[guides.radialSegments]}
            onValueChange={([v]) => onChange({ radialSegments: v ?? 8 })}
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-panel-border pt-3">
        <span className="text-xs text-muted-foreground">
          View rotation <span className="font-mono">{Math.round(rotationDeg)}°</span>
        </span>
        <button
          type="button"
          onClick={onResetRotation}
          className="rounded-lg px-2.5 py-1.5 text-[11px] text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Straighten
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pinch with two fingers and twist to rotate the canvas — the artwork itself is unaffected.
      </p>
    </div>
  );
}
