import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-varg")({
  head: () => motifHead("tatuering-varg"),
  component: () => <SvMotifLanding slug="tatuering-varg" />,
});
