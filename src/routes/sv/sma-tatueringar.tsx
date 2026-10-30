import { createFileRoute } from "@tanstack/react-router";
import { SvMotifLanding, motifHead } from "@/components/SvMotifLanding";

export const Route = createFileRoute("/sv/sma-tatueringar")({
  head: () => motifHead("sma-tatueringar"),
  component: () => <SvMotifLanding slug="sma-tatueringar" />,
});
