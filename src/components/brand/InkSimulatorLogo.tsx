/**
 * InkSimulator vector concepts and the official uploaded primary logo.
 *
 * Design system reuse only:
 *  - Type: var(--font-display) = "Space Grotesk" (same as the homepage headings)
 *  - Color: currentColor everywhere, accent = var(--accent) (#8A5BF2)
 *  - Flat vector, single stroke weight, no gradients/glow/shadow.
 *
 * Three concepts:
 *  1. "needle"   — angled single-line tattoo needle inside AR viewfinder brackets
 *  2. "drop"     — ink drop whose base resolves into a scan crosshair
 *  3. "wordmark" — type only, with one continuous fine needle line
 */

// The existing source-derived official logo ships with the app so new domains
// do not depend on another Lovable project's asset proxy.
const officialLogoUrl = "/brand/inksimulator-logo.png";

export type LogoConcept = "needle" | "drop" | "wordmark";

type MarkProps = {
  className?: string;
  /** Stroke weight in the 32-unit viewBox. Default 2. */
  strokeWidth?: number;
  /** Accent color for the highlight detail. Defaults to the theme accent. */
  accent?: string;
  title?: string;
};

/* ------------------------------------------------------------------ */
/* 1. Needle + preview                                                 */
/* ------------------------------------------------------------------ */

export function NeedleMark({
  className,
  strokeWidth = 2,
  accent = "var(--accent)",
  title = "InkSimulator",
}: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        {/* AR viewfinder corners */}
        <path d="M3 9.5V3h6.5" />
        <path d="M22.5 3H29v6.5" />
        <path d="M29 22.5V29h-6.5" />
        <path d="M9.5 29H3v-6.5" />
      </g>
      {/* Tattoo needle: grip bar, thin shaft, tapered tip */}
      <g stroke="currentColor" strokeLinecap="butt">
        <path d="M21.5 6 26 10.5" strokeWidth={strokeWidth * 1.6} />
        <path d="M23.4 9.1 15.4 17.1" strokeWidth={strokeWidth * 0.9} />
      </g>
      <path
        d="M15.9 17.6 11 22l3-5.4z"
        fill="currentColor"
        stroke="none"
      />
      {/* the point being previewed */}
      <circle cx="11" cy="22" r={strokeWidth * 0.42} fill={accent} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Ink drop becoming a frame                                        */
/* ------------------------------------------------------------------ */

export function DropMark({
  className,
  strokeWidth = 2,
  accent = "var(--accent)",
  title = "InkSimulator",
}: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        {/* Drop: sharp apex, sides falling straight down */}
        <path d="M16 3 9 15.5" />
        <path d="M16 3 23 15.5" />
        {/* Base resolves into scan-corner brackets */}
        <path d="M9 15.5v12H14" />
        <path d="M23 15.5v12H18" />
      </g>
      {/* Crosshair inside the frame */}
      <g stroke={accent} strokeWidth={strokeWidth} strokeLinecap="butt">
        <path d="M16 18.5v6.5" />
        <path d="M12.8 21.8h6.4" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Wordmark-led fine line                                           */
/* ------------------------------------------------------------------ */

export function LineMark({
  className,
  strokeWidth = 2,
  accent = "var(--accent)",
  title = "InkSimulator",
}: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* One continuous fine needle line: enters flat, lifts, tapers off */}
      <path
        d="M2.5 22.5c5.5 0 8.5-1.5 12-6.5S21 6.5 26 6.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M2.5 26.5h17"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.6}
        strokeLinecap="round"
        opacity={0.5}
      />
      <circle cx="28.6" cy="6.5" r={strokeWidth * 1.15} fill={accent} />
    </svg>
  );
}

export function InkSimulatorMark({
  concept = "needle",
  ...props
}: MarkProps & { concept?: LogoConcept }) {
  if (concept === "drop") return <DropMark {...props} />;
  if (concept === "wordmark") return <LineMark {...props} />;
  return <NeedleMark {...props} />;
}

/* ------------------------------------------------------------------ */
/* Horizontal lockups                                                  */
/* ------------------------------------------------------------------ */

export function InkSimulatorWordmark({
  className,
  accent = "var(--accent)",
  /** Show the continuous needle underline (concept 3). */
  underline = false,
  suffix = false,
}: {
  className?: string;
  accent?: string;
  underline?: boolean;
  suffix?: boolean;
}) {
  return (
    <span className={className}>
      <span className="relative inline-block font-display font-bold tracking-[-0.02em] leading-none">
        <span>Ink</span>
        <span style={{ color: accent }}>Simulator</span>
        {suffix ? <span className="font-medium">.com</span> : null}
        {underline ? (
          <svg
            viewBox="0 0 200 10"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute left-0 -bottom-[0.22em] h-[0.3em] w-full"
            fill="none"
          >
            <path
              d="M1 7c34-6 62 3 96-1 25-3 40 4 55 0 12-3 20-1 47-3"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Primary lockup — the official InkSimulator logo artwork.
 * `markClassName` still drives the height so existing call sites keep their scale.
 */
export function InkSimulatorLockup({
  className,
  markClassName = "h-8 w-8",
  imgClassName,
}: {
  concept?: LogoConcept;
  className?: string;
  markClassName?: string;
  textClassName?: string;
  accent?: string;
  suffix?: boolean;
  strokeWidth?: number;
  imgClassName?: string;
}) {
  const height = markClassName.split(" ").find((c) => c.startsWith("h-")) ?? "h-8";
  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      <img
        src={officialLogoUrl}
        alt="InkSimulator"
        className={imgClassName ?? `${height} w-auto`}
        draggable={false}
      />
    </span>
  );
}

export default InkSimulatorLockup;
