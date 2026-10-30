import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/realistisk-tatuering")({
  head: () => motifHead("realistisk-tatuering"),
  component: Page,
});

function Page() { return <SvMotifLanding slug="realistisk-tatuering" />; }