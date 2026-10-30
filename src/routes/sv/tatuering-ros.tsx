import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-ros")({
  head: () => motifHead("tatuering-ros"),
  component: () => <SvMotifLanding slug="tatuering-ros" />,
});
