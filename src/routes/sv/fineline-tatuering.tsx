import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/fineline-tatuering")({
  head: () => motifHead("fineline-tatuering"),
  component: Page,
});

function Page() { return <SvMotifLanding slug="fineline-tatuering" />; }