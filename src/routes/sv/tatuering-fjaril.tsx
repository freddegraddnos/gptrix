import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-fjaril")({
  head: () => motifHead("tatuering-fjaril"),
  component: () => <SvMotifLanding slug="tatuering-fjaril" />,
});
