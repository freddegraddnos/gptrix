import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/djur-tatuering")({
  head: () => motifHead("djur-tatuering"),
  component: Page,
});

function Page() { return <SvMotifLanding slug="djur-tatuering" />; }