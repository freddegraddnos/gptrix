import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tx } from "@/lib/uiLang";
import { PLACEMENTS, arBodyPart, placementLabel } from "@/lib/motifPlacement";

/** Simple silhouettes per placement (viewBox 0 0 200 300). */
const SHAPES: Record<string, string> = {
  upperarm: "M70 20 Q100 5 130 20 L125 280 Q100 292 75 280 Z",
  forearm: "M75 20 Q100 10 125 20 L115 280 Q100 288 85 280 Z",
  arm: "M70 10 Q100 0 130 10 L118 290 Q100 298 82 290 Z",
  hand: "M60 120 L60 40 Q70 30 80 40 L80 110 L85 30 Q95 20 105 30 L105 110 L110 35 Q120 25 130 35 L130 120 L150 90 Q165 95 155 115 L130 200 Q100 260 70 200 Z",
  neck: "M70 20 L130 20 L135 200 Q160 230 190 250 L10 250 Q40 230 65 200 Z",
  back: "M30 20 Q100 0 170 20 L160 280 Q100 295 40 280 Z",
  chest: "M20 30 Q100 10 180 30 L170 270 Q100 290 30 270 Z",
  thigh: "M55 10 Q100 0 145 10 L125 290 Q100 296 75 290 Z",
  calf: "M75 10 Q115 20 120 90 L110 290 Q100 296 88 290 L80 90 Z",
  leg: "M60 5 Q100 0 140 5 L115 295 Q100 299 85 295 Z",
};

export function BodyPlacementPreview({
  motifId,
  imageUrl,
  placements,
}: {
  motifId: string;
  imageUrl: string | null;
  placements: string[];
}) {
  const options = placements.length ? placements : PLACEMENTS.map((p) => p.id);
  const [part, setPart] = useState<string>(options[0]);
  const [size, setSize] = useState(45);
  const [y, setY] = useState(45);
  const ar = arBodyPart(part);

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {options.map((p) => (
          <Button key={p} type="button" size="sm" variant={part === p ? "default" : "outline"} onClick={() => setPart(p)} className="shrink-0 rounded-full text-xs">
            {tx(placementLabel(p))}
          </Button>
        ))}
      </div>
      <div className="relative mx-auto aspect-[2/3] w-full max-w-[240px] rounded-lg bg-card">
        <svg viewBox="0 0 200 300" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={SHAPES[part] ?? SHAPES.forearm} strokeWidth="2" className="fill-muted stroke-foreground/40" />
        </svg>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-multiply"
            style={{ top: `${y}%`, width: `${size}%` }}
          />
        )}
      </div>
      <label className="mt-3 block text-xs">{tx("Size")}
        <input type="range" min={15} max={90} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" />
      </label>
      <label className="block text-xs">{tx("Position")}
        <input type="range" min={15} max={85} value={y} onChange={(e) => setY(Number(e.target.value))} className="w-full" />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        {tx("This is a placement suggestion. Final size and suitability are agreed with the tattoo artist.")}
      </p>
      {ar && (
        <Button asChild size="sm" variant="outline" className="mt-3 gap-2">
          <Link to="/ar" search={{ motif: motifId } as never}><Camera className="size-4" /> {tx("Try in camera")}</Link>
        </Button>
      )}
    </div>
  );
}
