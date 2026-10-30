import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/japansk-tatuering")({
  head: () => motifHead("japansk-tatuering"),
  component: () => <SvMotifLanding slug="japansk-tatuering" />,
});
