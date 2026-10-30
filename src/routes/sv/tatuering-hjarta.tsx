import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-hjarta")({
  head: () => motifHead("tatuering-hjarta"),
  component: () => <SvMotifLanding slug="tatuering-hjarta" />,
});
