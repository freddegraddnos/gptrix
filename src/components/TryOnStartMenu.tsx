import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Image as ImageIcon, PenTool, ScanLine } from "lucide-react";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";
import { HOME_TESTIMONIALS } from "@/lib/testimonials";

import { tx, useUiLang } from "@/lib/uiLang";
/* ------------------------------------------------------------------ */
/*  Vertical rhythm — one 4px scale, five steps, no ad-hoc margins.    */
/*                                                                     */
/*    XS  8px   inside a card: kicker → title → line                   */
/*    S  12px   between the two choice cards                           */
/*    M  16px   headline → supporting line (same thought)              */
/*    L  40px   block breaks: subline → choices → kicker               */
/*    XL 48px   the one bigger break: logo → headline                  */
/*                                                                     */
/*  Hierarchy: XL > L > M > S > XS. Cards sit at the optical centre;   */
/*  the kicker + link row gives the bottom real weight so the screen   */
/*  never reads top-heavy. Budget at 393×732 ≈ 640px, no scroll.       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Choice surface — one silhouette shared by both cards               */
/* ------------------------------------------------------------------ */

type Emphasis = "primary" | "secondary";

const HOW_STEPS = [
  { title: "Think it", text: "Pick, create or upload a design. Our AI will make a white background transparent." },
  { title: "Try it", text: "See it on your skin in live AR at true 1:1 size, or place it on a photo you already have. Move, resize and compare." },
  { title: "Ink it", text: "Send it to friends and let them vote, prank them in reaction-cam mode — or send it to an approved studio and book." },
];

export const HOME_FAQ = [
  { q: "Is InkSimulator free?", a: "Yes. Trying tattoos on a photo or in live AR is free." },
  { q: "Do I need an app or an account?", a: "No app — it runs in your browser on iPhone, Android and desktop. You only need an account to save, share, send a booking request or use the AI generator." },
  { q: "Is my camera image stored?", a: "No. The camera stays on your device. Nothing is recorded or uploaded unless you choose to save or share a picture." },
  { q: "How accurate is the size?", a: "Live AR shows the design at real size (1:1) on your skin, so you can judge placement and scale before booking." },
  { q: "How do I book a studio?", a: "Tap Book tattoo, choose an approved studio and send your request with the try-on image. The studio replies by email, so you will need an account for this — but creating an account and sending a request is free, with no hidden costs." },
];

const surfaceBase = [
  "group relative block w-full overflow-hidden rounded-2xl border border-border text-left",
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-0",
  "transition-[transform,border-color,box-shadow] duration-200 ease-out",
  "hover:-translate-y-px hover:border-foreground/20",
  "active:translate-y-0 active:scale-[0.995]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
].join(" ");

const emphasis: Record<Emphasis, string> = {
  /* the accent moment on the pair: a violet light travelling around the card */
  primary: "top-beam bg-card",
  secondary: "soft-beam bg-card",
};

function surfaceClass(level: Emphasis) {
  return `${surfaceBase} ${emphasis[level]}`;
}

/* ------------------------------------------------------------------ */
/*  Choice body — identical chip, type, arrow on both                  */
/* ------------------------------------------------------------------ */

function Choice({
  Icon,
  kicker,
  title,
  text,
  compact = false,
}: {
  Icon: typeof ScanLine;
  kicker: string;
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center px-5 ${compact ? "gap-3 py-2.5" : "gap-4 py-5"}`}>
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.04] text-foreground transition-colors duration-200 group-hover:border-foreground/20 ${compact ? "size-10" : "size-11"}`}
      >
        <Icon className="size-5" strokeWidth={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <span className={`block leading-none uppercase text-muted-foreground ${compact ? "text-[9px] tracking-[0.16em]" : "text-[10px] tracking-[0.2em]"}`}>
          {kicker}
        </span>
        <h2 className={`font-display leading-none text-foreground ${compact ? "mt-1.5 text-[1.25rem]" : "mt-2 text-[1.375rem]"}`}>
          {title}
        </h2>
        <p className={`truncate leading-none text-muted-foreground ${compact ? "mt-1.5 text-[10px]" : "mt-2 text-[11px]"}`}>{text}</p>
      </div>

      <ArrowRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-foreground"
        strokeWidth={1.5}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quiet footer links                                                 */
/* ------------------------------------------------------------------ */

const quietLinkClass = [
  "inline-flex min-h-11 items-center rounded-md px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
  "transition-colors duration-150 hover:text-foreground active:text-foreground/80",
  "focus-visible:outline-none focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
].join(" ");

function QuietAction({
  onClick,
  to,
  search,
  children,
}: {
  onClick?: () => void;
  to: "/ar" | "/library" | "/profile" | "/artists" | "/for-studios" | "/about";
  search?: { start: "upload" | "text" };
  children: ReactNode;
}) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={quietLinkClass}>
        {children}
      </button>
    );
  }
  if (to === "/ar") {
    return (
      <Link to="/ar" search={search} className={quietLinkClass}>
        {children}
      </Link>
    );
  }
  return (
    <Link to={to} className={quietLinkClass}>
      {children}
    </Link>
  );
}

function Dot() {
  return <span aria-hidden className="size-0.5 rounded-full bg-foreground/25" />;
}

/* ------------------------------------------------------------------ */
/*  Start screen                                                       */
/* ------------------------------------------------------------------ */

export function TryOnStartMenu({
  showLogo = false,
  onTryDesign,
  onUpload,
  onText,
}: {
  showLogo?: boolean;
  onTryDesign?: () => void;
  onUpload?: () => void;
  onText?: () => void;
}) {
  useUiLang();
  const inCameraFlow = Boolean(onUpload || onText);

  const live = (
    <Choice
      Icon={ScanLine}
      kicker="Live AR"
      title={showLogo ? tx("Live AR Try-On") : tx("Try tattoos in live mode")}
      text="Real time · true 1:1 scale"
      compact={showLogo}
    />
  );

  return (
    <div className={`mx-auto w-full text-center ${showLogo ? "max-w-[40rem]" : "max-w-sm"}`}>
      {/* Fill the available width with the mark, cropping only the empty edges of the supplied artwork. */}
      {showLogo && (
        <div className="logo-3d mx-auto mb-7 aspect-[2/1] w-full max-w-[42rem] overflow-hidden rounded-xl sm:w-full sm:max-w-[42rem] sm:translate-x-0">
          <InkSimulatorLockup
            className="relative h-full w-full justify-center overflow-hidden"
            imgClassName="absolute left-1/2 top-1/2 h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2"
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-sm">
      {/* Headline through the choices sit on the logo's violet AR grid */}
      <div className="relative">
        {!showLogo && <div aria-hidden className="ar-grid" />}
      {/* Headline + supporting line — M between them */}
      <header className="relative z-10">

        {showLogo ? (
          <>
            <h1 className="ink-shadow font-display text-[1.55rem] leading-[1.07] text-foreground sm:text-[1.9rem]">{tx("Try any tattoo on your skin in AR — before it’s permanent.")}</h1>
            <p className="mx-auto mt-2 text-[11px] leading-[1.5] text-muted-foreground">{tx("Try it before it’s forever")}</p>
          </>
        ) : (
          <>
            <h1 className="ink-shadow font-display text-[2.625rem] leading-[1.04] text-foreground">{tx("Try it before")}<br />{tx("it’s forever")}</h1>
            <p className="mx-auto mt-2 max-w-[34ch] text-[12px] leading-[1.5] text-muted-foreground">{tx("Don’t imagine your next tattoo — see it in AR!")}</p>
          </>
        )}
      </header>

      {/* The choices — L above, S between */}
      <div className={`relative z-10 grid ${showLogo ? "mt-4 gap-2" : "mt-8 gap-3"}`}>
        {showLogo && (
          <p className="pulse-line mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
            {tx("Think it — Try it — Ink it")}
          </p>
        )}
        {showLogo && <Link to="/ar" search={{ start: "design" }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-accent bg-accent px-4 font-display text-lg uppercase text-accent-foreground transition-colors hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{tx("Try it free — no app needed")}{" "}<ArrowRight className="size-4" /></Link>}
        {showLogo && <p className="-mt-1 mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{tx("No sign-up needed")}</p>}
        {onTryDesign ? (
          <button type="button" onClick={onTryDesign} className={surfaceClass("primary")}>
            {live}
          </button>
        ) : (
          <Link to="/ar" search={{ start: "design" }} className={surfaceClass("primary")}>
            {live}
          </Link>
        )}

        <Link to="/photo-tryon" search={{ motif: undefined }} className={surfaceClass("secondary")}>
          <Choice
            Icon={ImageIcon}
            kicker="Photo try-on"
            title={tx("On a photo")}
            text="Put ink on a pic · no camera"
              compact={showLogo}
          />
        </Link>
        {showLogo && (
          <Link to="/create" className={surfaceClass("secondary")}>
            <Choice
              Icon={PenTool}
              kicker="Make it yours"
              title={tx("Create")}
              text="AI · upload · draw & text"
              compact
            />
          </Link>
        )}
        {showLogo && (
          <Link to="/studios" className={surfaceClass("secondary")}>
            <Choice
              Icon={CalendarDays}
              kicker="Your next step"
              title={tx("Book tattoo")}
              text="Find an approved studio"
              compact
            />
          </Link>
        )}
      </div>
      </div>

      {showLogo && (
        <section aria-label={tx("What people say")} className="relative z-10 mt-10 text-left">
          <p className="mb-3 text-center text-[10px] uppercase tracking-[0.22em] text-accent">{tx("What people say")}</p>
          <div className="grid gap-3">
            {HOME_TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border border-border bg-card/90 p-5 shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
                <span aria-hidden className="font-display text-3xl leading-none text-accent">{tx("&ldquo;")}</span>
                <blockquote className="mt-1 text-[12px] leading-[1.6] text-foreground">{t.quote}</blockquote>
                <figcaption className="mt-3 font-display text-sm uppercase text-muted-foreground">{t.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {showLogo && (
        <section aria-labelledby="how-it-works" className="relative z-10 mt-12 text-left">
          <h2 id="how-it-works" className="text-center font-display text-2xl uppercase text-foreground">{tx("Think it — Try it — Ink it")}</h2>
          <ol className="mt-4 grid gap-3">
            {HOW_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-2xl border border-border bg-card/90 p-5">
                <span className="font-display text-3xl leading-none text-accent">{i + 1}</span>
                <span>
                  <h3 className="font-display text-lg uppercase leading-none text-foreground">{tx(step.title)}</h3>
                  <p className="mt-2 text-[12px] leading-[1.6] text-muted-foreground">{tx(step.text)}</p>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {showLogo && (
        <section aria-labelledby="home-faq" className="relative z-10 mt-12 text-left">
          <h2 id="home-faq" className="text-center font-display text-2xl uppercase text-foreground">{tx("Questions")}</h2>
          <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card/90">
            {HOME_FAQ.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-foreground">
                  {f.q}
                  <span aria-hidden className="text-accent transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[12px] leading-[1.6] text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {showLogo && (
        <section aria-labelledby="for-studios-heading" className="mt-16 border-t-2 border-accent/60 bg-card/90 px-5 py-8 ink-shadow">
          <p className="text-[10px] uppercase tracking-[0.28em] text-accent">{tx("For tattoo studios")}</p>
          <h2 id="for-studios-heading" className="mt-2 font-display text-3xl uppercase leading-none text-foreground">
            {tx("Built for tattoo studios")}
          </h2>
          <ul className="mt-5 space-y-4 text-[13px] leading-[1.6] text-foreground">
            <li><span className="font-bold text-accent">{tx("More customers.")}</span>{" "}{tx("Thousands of visitors simulate and create tattoo projects here — why not let them send you a request?")}</li>
            <li><span className="font-bold text-accent">{tx("Happier customers.")}</span>{" "}{tx("78% of people who regret a tattoo name size and placement. Details are everything — the rest is just details.")}</li>
            <li><span className="font-bold text-accent">{tx("Save your time.")}</span>{" "}{tx("No more printing stencil after stencil. Stencils are a work tool, not a preview experience.")}</li>
          </ul>
          <Link to="/for-studios" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-sm border border-foreground bg-foreground px-5 font-display text-lg uppercase text-background transition-colors hover:bg-accent hover:border-accent">
            {tx("For studios")}{" "}<ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>
      )}

      {!showLogo && (
        <div aria-hidden className="mt-10 flex items-center gap-4">
          <span className="h-px flex-1 bg-border" />
          <p className="text-[9.5px] leading-none uppercase tracking-[0.32em] text-accent">
            {tx("Think it — Try it — Ink it")}
          </p>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Footer links — M below the kicker, 44px tap height */}
      {!showLogo && <nav
        aria-label={tx("More ways to start")}
        className="mt-4 flex flex-wrap items-center justify-center gap-x-4"
      >
        {inCameraFlow ? (
          <>
            <QuietAction onClick={onUpload} to="/ar" search={{ start: "upload" }}>
              {tx("Your drawing")}
            </QuietAction>
            <Dot />
            <QuietAction onClick={onText} to="/ar" search={{ start: "text" }}>
              {tx("Text tattoo")}
            </QuietAction>
            <Dot />
            <QuietAction to="/library">{tx("Browse motifs")}</QuietAction>
          </>
        ) : (
          <>
            <QuietAction to="/profile">{tx("My profile")}</QuietAction>
            <Dot />
            <QuietAction to="/for-studios">{tx("For studios")}</QuietAction>
            <Dot />
            <QuietAction to="/about">{tx("About")}</QuietAction>
          </>
        )}
      </nav>}
      </div>
    </div>
  );
}