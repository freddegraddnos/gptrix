import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { NO_ADJUST, type AdjustSettings } from "@/lib/paint/adjust";

interface Control {
  key: keyof AdjustSettings;
  label: string;
  min: number;
  max: number;
  suffix: string;
}

const CONTROLS: Control[] = [
  { key: "brightness", label: "Brightness", min: -80, max: 80, suffix: "%" },
  { key: "contrast", label: "Contrast", min: -80, max: 80, suffix: "%" },
  { key: "saturation", label: "Saturation", min: -100, max: 100, suffix: "%" },
  { key: "hue", label: "Hue", min: -180, max: 180, suffix: "°" },
  { key: "blur", label: "Gaussian blur", min: 0, max: 50, suffix: " px" },
];

/**
 * Live adjustments on the active layer.
 *
 * Opening the panel starts a session on the engine, every slider move re-renders
 * the layer from the untouched copy, and only "Apply" records an undo step —
 * closing the panel or pressing Cancel puts the original pixels back.
 */
export function AdjustPanelBody({
  onBegin,
  onPreview,
  onCommit,
  onCancel,
}: {
  onBegin: () => boolean;
  onPreview: (settings: AdjustSettings) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const [settings, setSettings] = useState<AdjustSettings>({ ...NO_ADJUST });
  const [ready, setReady] = useState(false);
  /** Set when the artist confirmed, so unmount must not roll the layer back. */
  const committed = useRef(false);

  useEffect(() => {
    const ok = onBegin();
    setReady(ok);
    return () => {
      if (!committed.current) onCancel();
    };
    // The session belongs to this mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<AdjustSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onPreview(next);
  };

  if (!ready) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        Select a visible, unlocked layer to adjust it.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {CONTROLS.map((c) => (
        <div key={c.key}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <span className="font-mono text-xs text-foreground/70">
              {Math.round(settings[c.key])}
              {c.suffix}
            </span>
          </div>
          <Slider
            min={c.min}
            max={c.max}
            step={1}
            value={[settings[c.key]]}
            onValueChange={([v]) => update({ [c.key]: v ?? 0 } as Partial<AdjustSettings>)}
          />
        </div>
      ))}

      <div className="flex gap-2 border-t border-panel-border pt-3">
        <button
          type="button"
          onClick={() => {
            committed.current = true;
            onCommit();
          }}
          className="flex-1 rounded-lg bg-primary/20 px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/30"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            setSettings({ ...NO_ADJUST });
            onPreview({ ...NO_ADJUST });
          }}
          className="rounded-lg px-3 py-2 text-xs text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Reset
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        The adjustment is shown live on the layer and can be undone afterwards.
      </p>
    </div>
  );
}
