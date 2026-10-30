import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-fagel")({
  head: () => motifHead("tatuering-fagel"),
  component: () => <SvMotifLanding slug="tatuering-fagel" />,
});
