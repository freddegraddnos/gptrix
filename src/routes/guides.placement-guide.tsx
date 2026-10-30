import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Image as ImageIcon, Ruler } from "lucide-react";

const CANONICAL = "https://www.inksimulator.com/guides/placement-guide";

export const Route = createFileRoute("/guides/placement-guide")({
  head: () => ({
    meta: [
      { title: "Tattoo Placement Guide — Where to Get Your Tattoo" },
      {
        name: "description",
        content:
          "Tattoo placement guide: pain, visibility, ageing and typical size by body part, a checklist for choosing between spots, and a free way to preview it on yourself.",
      },
      { property: "og:title", content: "Tattoo Placement Guide — InkSimulator" },
      {
        property: "og:description",
        content:
          "Choose the right spot for your tattoo: pain, visibility, ageing and size by body part, plus a free live or photo preview.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Tattoo Placement Guide — Where to Get Your Tattoo",
          description:
            "Pain levels, visibility, ageing and sizing by body part, with an AR preview at 1:1 scale.",
          mainEntityOfPage: CANONICAL,
          publisher: { "@id": "https://www.inksimulator.com/#organization" },
        }),
      },
    ],
  }),
  component: PlacementGuide,
});

type Spot = {
  area: string;
  pain: string;
  visibility: string;
  size: string;
  note: string;
};

const SPOTS: Spot[] = [
  {
    area: "Outer forearm",
    pain: "Low",
    visibility: "High",
    size: "8–18 cm",
    note: "Flat, easy to see on yourself and one of the most forgiving areas for fine line work.",
  },
  {
    area: "Inner forearm",
    pain: "Low–medium",
    visibility: "Medium",
    size: "7–16 cm",
    note: "Softer skin, slightly more sensitive. Great for lettering read from your own view.",
  },
  {
    area: "Upper arm / shoulder",
    pain: "Low",
    visibility: "Low with sleeves",
    size: "10–20 cm",
    note: "Muscle padding keeps pain down and the shape holds up well over time.",
  },
  {
    area: "Ribs",
    pain: "High",
    visibility: "Low",
    size: "12–25 cm",
    note: "Thin skin over bone. Plan longer sessions and expect a curved surface.",
  },
  {
    area: "Back / shoulder blade",
    pain: "Medium",
    visibility: "Low",
    size: "15–35 cm",
    note: "Largest usable canvas — best for detailed pieces you want to grow later.",
  },
  {
    area: "Thigh",
    pain: "Low–medium",
    visibility: "Low",
    size: "12–30 cm",
    note: "Lots of space, low pain, easy to hide. A common spot for a first large piece.",
  },
  {
    area: "Calf",
    pain: "Medium",
    visibility: "Medium",
    size: "10–22 cm",
    note: "Holds detail well. The curve means placement matters more than size.",
  },
  {
    area: "Ankle / foot",
    pain: "High",
    visibility: "Medium",
    size: "4–9 cm",
    note: "Bony and prone to faster fading from shoes and friction.",
  },
  {
    area: "Neck / hands",
    pain: "High",
    visibility: "Very high",
    size: "3–10 cm",
    note: "Hard to cover at work and fades quickest. Worth previewing before you commit.",
  },
];

function PlacementGuide() {
  return (
    <main className="min-h-screen bg-ink text-foreground">
      <article className="mx-auto max-w-2xl px-5 py-10">
        <div className="text-mono-caps text-[10px] tracking-widest text-accent">
          Guide
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight">
          Tattoo placement guide: where to get your tattoo
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Placement changes how a tattoo hurts, how it ages, how big it needs to
          be, and how often you will see it. This guide walks through the four
          decisions that matter, then gives a body-part comparison you can use
          before your consultation.
        </p>

        <h2 className="mt-10 font-display text-xl font-bold">1. Pain tolerance</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pain tracks with thin skin over bone and dense nerve endings. Ribs,
          ankles, hands, and the neck are the sharpest; outer arms, shoulders,
          and thighs sit at the calm end because muscle and fat cushion the
          needle. If it is your first tattoo, a low-pain area lets you learn how
          your body reacts before booking a long session.
        </p>

        <h2 className="mt-8 font-display text-xl font-bold">2. Visibility</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Decide who should see it. Forearms and calves are visible most of the
          year; back, ribs, and upper thigh disappear under everyday clothing.
          Hands, neck, and face are effectively permanent visibility — check
          your workplace policy first.
        </p>

        <h2 className="mt-8 font-display text-xl font-bold">3. How it ages</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Areas with heavy friction or sun exposure fade fastest: hands, feet,
          inner fingers, and the outer forearm. Skin that stretches or moves a
          lot — stomach, inner elbow — can distort fine detail. Denser line work
          and simpler shapes hold up better in those spots.
        </p>

        <h2 className="mt-8 font-display text-xl font-bold">4. Size and shape</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Match the design shape to the body part: long vertical designs suit
          forearms, calves, and the spine; circular designs suit shoulders and
          the outer thigh. Detail needs room — a piece with fine linework rarely
          survives below about 8 cm.
        </p>

        <h2 className="mt-10 font-display text-xl font-bold">
          Body-part comparison
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Sizes are rough starting points for an adult body, not rules. Your
          artist will confirm what works for your design and anatomy.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">Area</th>
                <th className="px-3 py-2 font-bold">Pain</th>
                <th className="px-3 py-2 font-bold">Visibility</th>
                <th className="px-3 py-2 font-bold">Typical size</th>
              </tr>
            </thead>
            <tbody>
              {SPOTS.map((s) => (
                <tr key={s.area} className="border-t border-white/10 align-top">
                  <td className="px-3 py-3">
                    <div className="font-bold">{s.area}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.note}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{s.pain}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {s.visibility}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{s.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 font-display text-xl font-bold">
          How to choose between two spots
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Print or preview the design at the size you want, not smaller.</li>
          <li>Look at it from your own view and in a mirror — forearm pieces are read by you, back pieces by others.</li>
          <li>Move your arm or leg: check how the design bends at the elbow, wrist or knee.</li>
          <li>Check it in the clothes you wear most, including work clothes.</li>
          <li>Leave it for a day, then compare again before you book.</li>
        </ol>

        <h2 className="mt-10 font-display text-xl font-bold">
          Questions to ask your artist
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Is this size big enough for the detail in my design?</li>
          <li>Will this placement distort the design when I move?</li>
          <li>How will this spot age compared with the alternatives?</li>
          <li>Should I leave room to extend it later?</li>
        </ul>

        <h2 className="mt-10 font-display text-xl font-bold">
          Preview the placement before you book
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The fastest way to settle a placement debate is to see the design on
          your own skin. With InkSimulator you can try a design live through
          your phone camera, or place it on a photo of yourself — free, in the
          browser, without an app. Treat it as a placement suggestion: the
          final size and fit are always agreed with your tattoo artist.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/ar"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-ink"
          >
            Try a placement live
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/photo-tryon"
            search={{ motif: undefined }}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-bold"
          >
            <ImageIcon className="size-4" />
            Try it on a photo
          </Link>
          <Link
            to="/library"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-bold"
          >
            <Ruler className="size-4" />
            Browse designs
          </Link>
        </div>
      </article>
    </main>
  );
}
