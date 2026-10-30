import { pageRulerTicks } from "@/lib/paint/printLayout";
import { tx } from "@/lib/uiLang";

export function PageRuler({ lengthMm, vertical = false }: { lengthMm: number; vertical?: boolean }) {
  return (
    <svg role="img" aria-label={tx(vertical ? "Vertical paper ruler in cm" : "Horizontal paper ruler in cm")}
      className="block h-full w-full overflow-visible text-foreground">
      {pageRulerTicks(lengthMm).map((tick) => {
        const at = `${tick.mm / lengthMm * 100}%`;
        const len = tick.major ? 10 : tick.medium ? 7 : 3;
        const label = tick.mm === 0 || tick.mm === lengthMm || (tick.mm % 50 === 0 && lengthMm - tick.mm >= 30) ? tick.label : undefined;
        return <g key={tick.mm}>
          {vertical ? <line x1={36 - len} x2={36} y1={at} y2={at} stroke="currentColor" />
            : <line x1={at} x2={at} y1={0} y2={len} stroke="currentColor" />}
          {label && <text x={vertical ? 22 : at} y={vertical ? at : 24}
            textAnchor={vertical ? "end" : tick.mm === 0 ? "start" : tick.mm === lengthMm ? "end" : "middle"}
            dominantBaseline={vertical ? tick.mm === 0 ? "hanging" : tick.mm === lengthMm ? "auto" : "middle" : "auto"}
            className="fill-current font-mono text-[10px]">{label}</text>}
        </g>;
      })}
    </svg>
  );
}