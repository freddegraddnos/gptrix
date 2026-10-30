/**
 * Diagonal InkSimulator watermark used on artwork that isn't free, so studio
 * designs and gallery photos can't simply be lifted out of the app.
 */
export function InkWatermark({ label = "INKSIMULATOR" }: { label?: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <div className="absolute inset-[-30%] rotate-[-24deg] flex flex-col justify-around">
        {Array.from({ length: 7 }).map((_, row) => (
          <div
            key={row}
            className="flex justify-around whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.35em] text-white/25 mix-blend-overlay"
          >
            {Array.from({ length: 4 }).map((__, col) => (
              <span key={col}>{label}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Image with an optional InkSimulator watermark layer on top. */
export function WatermarkedImage({
  src,
  alt,
  watermark,
  className = "",
  imgClassName = "h-full w-full object-cover",
}: {
  src: string;
  alt: string;
  watermark?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={!watermark}
        className={`${imgClassName} ${watermark ? "select-none [-webkit-touch-callout:none]" : ""}`}
      />
      {watermark && <InkWatermark />}
      {/* Transparent shield: blocks long-press "save image" on touch devices. */}
      {watermark && <div aria-hidden className="absolute inset-0" />}
    </div>
  );
}

