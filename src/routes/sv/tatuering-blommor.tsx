import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-blommor")({
  head: () => motifHead("tatuering-blommor"),
  component: () => <SvMotifLanding slug="tatuering-blommor" />,
});
