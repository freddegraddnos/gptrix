import { createFileRoute } from "@tanstack/react-router";
import { PaintStudio } from "@/components/paint/PaintStudio";

export const Route = createFileRoute("/rita")({
  head: () => ({
    meta: [
      { title: "Drawing Studio — sketch your tattoo | InkSimulator" },
      {
        name: "description",
        content:
          "Draw tattoo designs directly in InkSimulator: pressure-sensitive brushes, layers, text, stencils and true-to-size printing.",
      },
      { property: "og:title", content: "Drawing Studio — InkSimulator" },
      {
        property: "og:description",
        content:
          "Pressure-sensitive brushes, layers, stencils and 1:1 printing — sketch your next tattoo in the browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: RitaPage,
});

function RitaPage() {
  return (
    <main>
      <h1 className="sr-only">InkSimulator Drawing Studio</h1>
      <PaintStudio />
    </main>
  );
}
