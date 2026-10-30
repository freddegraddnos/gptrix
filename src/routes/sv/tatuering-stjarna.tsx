import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-stjarna")({
  head: () => motifHead("tatuering-stjarna"),
  component: () => <SvMotifLanding slug="tatuering-stjarna" />,
});
