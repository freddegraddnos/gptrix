import { publicSiteUrl } from "@/lib/publicOrigin";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HOME_FAQ } from "@/components/TryOnStartMenu";
import { HomePosterPage } from "@/components/HomePosterPage";
import { safeRedirect, takePendingRedirect } from "@/lib/authRedirect";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";


export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () =>
    seo({
      path: "/",
      title: "InkSimulator – AR Tattoo Try-On on Your Skin or a Photo",
      description:
        "InkSimulator is a free tattoo try-on web app. Preview a design on your skin in live AR at 1:1 scale or on a photo, explore designs, and connect with an approved studio.",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "InkSimulator",
          url: publicSiteUrl("/"),
          applicationCategory: "LifestyleApplication",
          operatingSystem: "iOS, Android, Web",
          description:
            "Try any tattoo on your own skin in live AR at true 1:1 scale, or on a photo, before booking a tattoo artist.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "SEK" },
          publisher: { "@id": publicSiteUrl("/#organization") },
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: HOME_FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      ],
    }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { redirect } = Route.useSearch();
  const [isWsHost, setIsWsHost] = useState(false);

  // ws.inkvision.app serves the pitch page at its root, not the try-on start menu.
  useEffect(() => {
    if (window.location.hostname === "ws.inkvision.app") setIsWsHost(true);
  }, []);

  // A mail link that went through login lands here — send it on to the page it asked for.
  useEffect(() => {
    if (loading || isWsHost) return;
    const target = safeRedirect(redirect) ?? (user ? takePendingRedirect() : undefined);
    if (target) navigate({ to: target as never, replace: true });
  }, [redirect, user, loading, navigate, isWsHost]);

  return (
    <>
      <HomePosterPage />
      <section className="sr-only" aria-label="About InkSimulator">

          <h2>InkSimulator — try tattoos on your skin before you get them</h2>
          <p>
            InkSimulator is a free web app that lets you try any tattoo on your own body in live
            augmented reality at true 1:1 scale, or on a photo you already have. It works in the
            browser on iPhone, Android and desktop.
          </p>
          <ul>
            <li><a href="/ar">Live AR try-on</a>: the design stays locked to your skin at real size.</li>
            <li><a href="/photo-tryon">Photo try-on</a>: put a tattoo on a picture, no camera needed.</li>
            <li><a href="/library">Design library</a>, <a href="/tattoo-font-generator">text tattoos</a> and <a href="/generator">AI-generated designs</a>.</li>
            <li><a href="/guides/placement-guide">Tattoo placement guide</a>: pain, visibility and size by body part.</li>
            <li><a href="/sv/prova-tatuering">Prova tatuering i AR</a> (svenska).</li>
            <li>På svenska: <a href="/sv/tatuering-text">tatuering med text</a>, <a href="/sv/ai-tatuering">AI-tatuering</a>, <a href="/sv/tatueringsmotiv">tatueringsmotiv</a>, <a href="/sv/tatuering-placering">placering och storlek</a>, <a href="/sv/pris-tatuering">vad kostar en tatuering</a> och <a href="/sv/boka-tatuering">boka tatuering</a>.</li>
            <li><a href="/studios">Book an approved tattoo studio</a> and send your try-on photos.</li>
            <li><a href="/for-studios">For tattoo studios</a>: bookings, calendar, stencils and client designs.</li>
          </ul>
      </section>
    </>
  );
}
