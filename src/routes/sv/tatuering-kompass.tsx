import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-kompass")({
  head: () => motifHead("tatuering-kompass"),
  component: () => <SvMotifLanding slug="tatuering-kompass" />,
});
