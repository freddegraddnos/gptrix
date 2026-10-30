import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — InkSimulator" },
      {
        name: "description",
        content:
          "The terms that apply when you use InkSimulator to try tattoo designs in AR, save placements, and contact studios.",
      },
      { property: "og:title", content: "Terms of Service — InkSimulator" },
      {
        property: "og:description",
        content: "The rules for using InkSimulator's AR tattoo try-on, saved placements and studio contact.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://www.inksimulator.com/terms" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/terms" }],
  }),
  component: TermsPage,
});

const SECTIONS = [
  {
    h: "Using InkSimulator",
    p: "InkSimulator lets you preview tattoo designs on your own skin with your camera. Previews are a visual aid, not a guarantee of the final tattoo — sizing, colour and healing always depend on you and your artist.",
  },
  {
    h: "Your account",
    p: "You need an account to save placements, vote sessions and projects. Keep your login details to yourself; you are responsible for activity on your account.",
  },
  {
    h: "Designs and uploads",
    p: "You keep the rights to anything you upload. Only upload artwork you own or are allowed to use. Curated designs in the catalog belong to their artists and are free to try in AR — they are not licensed for commercial resale.",
  },
  {
    h: "Studios and bookings",
    p: "Booking requests are sent to independent studios. InkSimulator is not a party to the appointment, the price or the tattoo itself.",
  },
  {
    h: "Availability",
    p: "Features can change while the product is developing. We may update or pause parts of the service, and we will keep this page current when we do.",
  },
  {
    h: "Contact",
    p: "Questions about these terms: hello@inksimulator.com",
  },
];

function TermsPage() {
  return (
    <AppShell showNav={false}>
      <TopBar title="Terms" />
      <h1 className="font-display font-bold text-2xl">Terms of Service</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Plain-language terms for using InkSimulator.
      </p>
      <div className="mt-5 space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.h} className="rounded-2xl border border-white/10 bg-slate/60 p-4">
            <h2 className="font-semibold text-sm">{s.h}</h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>
      <Link
        to="/privacy"
        className="mt-5 inline-flex h-11 items-center text-xs font-bold uppercase tracking-widest text-accent"
      >
        Privacy policy →
      </Link>
    </AppShell>
  );
}
