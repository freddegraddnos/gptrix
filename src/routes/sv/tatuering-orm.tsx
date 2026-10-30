import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/tatuering-orm")({
  head: () => motifHead("tatuering-orm"),
  component: () => <SvMotifLanding slug="tatuering-orm" />,
});
