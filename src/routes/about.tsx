import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Search, MessageCircle, Ruler, Upload, Share2, Star, Zap, Type, Lock, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";
import heroHud from "@/assets/hero-hud.jpg";
import stepPick from "@/assets/step-pick.jpg";
import stepCalibrate from "@/assets/step-calibrate.jpg";
import stepLock from "@/assets/step-lock.jpg";
import { seo } from "@/lib/seo";

const HOW_IT_WORKS = [
  {
    img: stepPick,
    step: "1",
    title: "Pick a design",
    desc: "Browse the library or upload your own sketch.",
  },
  {
    img: stepCalibrate,
    step: "2",
    title: "Calibrate with a coin",
    desc: "One match and every size on the skin is true 1:1.",
  },
  {
    img: stepLock,
    step: "3",
    title: "Lock it — see the cm",
    desc: "The design sticks to the arm while you move and film.",
  },
];


export const Route = createFileRoute("/about")({
  head: () => seo({ path: "/about", title: "About InkSimulator — Tattoo Try-On in AR and on Photos", description: "InkSimulator is a free web app to try tattoos on your skin in live AR at true 1:1 scale or on a photo, and to send requests to approved tattoo studios.", breadcrumb: "About" }),
  component: Landing,
});

const BENEFITS = [
  { icon: Upload, title: "Upload your drawings", desc: "AI makes the paper background transparent." },
  { icon: Search, title: "The full library", desc: "Thousands of designs, every style." },
  { icon: Sparkles, title: "AI generator", desc: "Create unique designs in seconds." },
  { icon: MessageCircle, title: "Contact artists", desc: "Book custom sketches." },
  { icon: Share2, title: "Save & share", desc: "Share designs with friends." },
  { icon: Ruler, title: "Export PDF", desc: "With exact measurements." },
];

const FEATURED_REVIEW = {
  name: "Sofia, 29",
  quote:
    "Last time I wished I hadn't made the tattoo bigger. That will never happen again! Such a relief to test the exact size and placement at home first.",
};

const TESTIMONIALS = [
  {
    name: "Jonas, 34",
    quote: "Saved loads of time at the studio. Size and placement were spot on right away",
  },
  {
    name: "Lina, 22",
    quote: "My friend and I could finally try out a design for our friendship tattoo",
  },
  {
    name: "Emma, 26",
    quote:
      "It's fun to try different designs — I think InkSimulator gave me the courage to book a tattoo appointment",
  },
];

function YourProjects() {
  const { user } = useAuth();
  const { projects } = useProjects(user?.id);
  if (!user || projects.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Your projects</h2>
        <Link to="/projects" className="text-[11px] text-accent font-bold">
          All
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {projects.slice(0, 4).map((p) => (
          <li
            key={p.id}
            className="rounded-2xl overflow-hidden border border-white/10 bg-slate"
          >
            <Link to="/projects/$id" params={{ id: p.id }}>
              <div className="aspect-square bg-ink grid place-items-center">
                {p.preview_url ? (
                  <img
                    src={p.preview_url}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-7 text-muted-foreground" />
                )}
              </div>
              <div className="p-2.5">
                <div className="text-[12px] font-bold truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("en-US")}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Landing() {
  return (
    <div className="min-h-[100dvh] bg-ink text-foreground">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-16">

        {/* Hero: copy + the real HUD */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:items-center">
          <div className="lg:order-1">
            <InkSimulatorLockup concept="needle" className="mt-1" markClassName="h-7 w-7" textClassName="text-xl" />
            <h1 className="mt-4 font-display text-[32px] lg:text-[52px] leading-[1.05] font-bold tracking-tight text-balance">
              See your tattoo — <span className="text-accent">before</span> the needle.
            </h1>
            <p className="mt-2.5 text-sm lg:text-base text-muted-foreground text-pretty">
              Unlimited AR at 1:1 scale, the full library, AI generator, saved projects, sharing and
              artist contact.
            </p>

            <div className="mt-6 hidden lg:flex gap-3">
              <Link
                to="/ar"
                className="h-14 px-7 rounded-2xl bg-accent text-ink font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_10px_40px_-10px_rgba(138,91,242,0.55)]"
              >
                <Zap className="size-4" strokeWidth={2.5} />
                Try it on my skin
              </Link>
              <Link
                to="/library"
                className="h-14 px-7 rounded-2xl border border-white/15 text-foreground font-bold text-[15px] flex items-center justify-center"
              >
                Browse designs
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-6 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="size-4 fill-accent text-accent" />
                  ))}
                </div>
                <span className="text-sm font-bold">4.9</span>
              </div>
              <blockquote className="mt-3 text-[13px] leading-snug text-foreground/90 text-pretty">
                "{FEATURED_REVIEW.quote}"
              </blockquote>
              <div className="mt-2 text-[11px] text-muted-foreground">— {FEATURED_REVIEW.name}</div>
            </div>
          </div>

          {/* Phone frame */}
          <div className="mt-8 lg:mt-0 lg:order-2 flex justify-center">
            <div className="relative w-full max-w-[300px] lg:max-w-[360px] rounded-[2.2rem] border border-white/12 bg-slate/60 p-2 shadow-[0_40px_120px_-40px_rgba(138,91,242,0.35)]">
              <img
                src={heroHud}
                alt="InkSimulator camera HUD: a dagger and serpent tattoo wrapped around a forearm with a 7.7 cm size pill and a Locked indicator"
                width={768}
                height={1344}
                className="w-full rounded-[1.7rem] object-cover"
              />
            </div>
          </div>
        </div>

        {/* How it works — real screens */}
        <section className="mt-12">
          <h2 className="font-display text-xl lg:text-2xl font-bold">How it works</h2>
          <ol className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map((s) => (
              <li key={s.step} className="rounded-2xl border border-white/8 bg-slate/40 overflow-hidden">
                <img
                  src={s.img}
                  alt={`Step ${s.step}: ${s.title}`}
                  loading="lazy"
                  width={640}
                  height={1136}
                  className="w-full aspect-[9/16] object-cover"
                />
                <div className="p-3.5">
                  <div className="text-mono-caps text-[10px] text-accent">Step {s.step}</div>
                  <div className="text-[14px] font-bold mt-1 leading-tight">{s.title}</div>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Benefits */}
        <ul className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-2">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="rounded-xl border border-white/5 bg-slate/60 p-3">
              <div className="size-7 rounded-lg bg-accent/15 grid place-items-center">
                <Icon className="size-3.5 text-accent" />
              </div>
              <div className="text-[12px] font-bold mt-2 leading-tight">{title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>
            </li>
          ))}
        </ul>

        <YourProjects />


        {/* Create your own designs */}

        <section className="mt-8 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 to-transparent p-4">
          <div className="text-mono-caps text-[10px] text-accent">Create your own</div>
          <h2 className="mt-1 font-display text-xl font-bold leading-tight">
            Your own image or your own text — right on the skin
          </h2>
          <ul className="mt-3 space-y-2.5">
            <li className="flex gap-2.5">
              <div className="size-7 rounded-lg bg-accent/15 grid place-items-center shrink-0">
                <Upload className="size-3.5 text-accent" />
              </div>
              <p className="text-[12px] text-foreground/85 leading-snug">
                <span className="font-bold">Upload your sketch.</span> Shoot it on
                white paper — our AI automatically makes the{" "}
                <span className="text-accent font-bold">white background transparent</span>{" "}
                so only the lines show on the skin. You can fine-tune tolerance and
                edges, or key out a different color.
              </p>
            </li>
            <li className="flex gap-2.5">
              <div className="size-7 rounded-lg bg-accent/15 grid place-items-center shrink-0">
                <Type className="size-3.5 text-accent" />
              </div>
              <p className="text-[12px] text-foreground/85 leading-snug">
                <span className="font-bold">Write a text tattoo.</span> Choose from
                18 tattoo fonts — script, blackletter, stencil and handwriting —
                curve the text in an arc and try it at 1:1 scale.
              </p>
            </li>
            <li className="flex gap-2.5">
              <div className="size-7 rounded-lg bg-accent/15 grid place-items-center shrink-0">
                <Lock className="size-3.5 text-accent" />
              </div>
              <p className="text-[12px] text-foreground/85 leading-snug">
                <span className="font-bold">Lock the placement.</span> Once size and
                placement feel right, lock the design — then you can record video, and
                the size adapts to the distance to your arm or leg.
              </p>
            </li>
          </ul>
          <Link
            to="/ar"
            className="mt-4 inline-flex h-11 px-4 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 text-accent text-[12px] font-bold uppercase tracking-widest"
          >
            Create your own design
          </Link>
        </section>

        {/* Testimonials */}
        <div className="mt-8">
          <div className="text-mono-caps text-[9px] text-muted-foreground mb-2">
            What others say
          </div>
          <div className="space-y-2">
            {TESTIMONIALS.map((t) => (
              <blockquote key={t.name} className="rounded-xl border border-white/5 bg-slate/40 p-3">
                <div className="flex gap-0.5 mb-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="size-2.5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-[12px] text-foreground/85 leading-snug">"{t.quote}"</p>
                <div className="text-[10px] text-muted-foreground mt-1">— {t.name}</div>
              </blockquote>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          Completely free · No card · No commitment
        </p>
      </div>

      {/* Stable facts — for people, search engines and AI assistants. */}
      <section aria-labelledby="facts" className="mx-auto w-full max-w-md lg:max-w-6xl px-6 pb-12 text-sm leading-relaxed text-muted-foreground">
        <h2 id="facts" className="font-display text-2xl uppercase text-foreground">InkSimulator facts</h2>
        <dl className="mt-4 grid gap-4 lg:grid-cols-2">
          <div><dt className="font-bold text-foreground">What it is</dt><dd>A free web app to try tattoos on your own skin in live AR at true 1:1 scale, or on a photo — no app and no sign-up needed.</dd></div>
          <div><dt className="font-bold text-foreground">Who it is for</dt><dd>People planning a tattoo, and tattoo artists and studios who want requests from clients who already tried the design.</dd></div>
          <div><dt className="font-bold text-foreground">Studio pricing (SEK)</dt><dd>Free trial throughout 2026 with no fixed studio fee or commission. See <Link to="/pricing" className="text-accent underline">pricing</Link>.</dd></div>
          <div><dt className="font-bold text-foreground">Contact</dt><dd><a href="mailto:studios@inksimulator.com" className="text-accent underline">studios@inksimulator.com</a> · <a href="tel:+46793288098" className="text-accent underline">+46 79 328 80 98</a></dd></div>
        </dl>
        <p className="mt-4 text-xs">Last updated: 1 October 2026</p>
      </section>

      {/* Mobile CTA follows the content rather than covering navigation. */}
      <div className="lg:hidden px-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <Link
            to="/ar"
            className="w-full h-14 rounded-2xl bg-accent text-ink font-bold text-[15px] active:scale-[0.98] transition shadow-[0_10px_40px_-10px_rgba(138,91,242,0.55)] flex items-center justify-center gap-2"
          >
            <Zap className="size-4" strokeWidth={2.5} />
            Try it on my skin
          </Link>
          <Link
            to="/library"
            className="mt-2 w-full h-12 rounded-2xl border border-white/15 text-foreground font-bold text-[13px] flex items-center justify-center"
          >
            Browse designs
          </Link>
        </div>
      </div>
    </div>
  );
}
