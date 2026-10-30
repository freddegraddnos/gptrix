import { createFileRoute } from "@tanstack/react-router";
import { SvCityPage, cityHead } from "@/components/SvCityLanding";

export const Route = createFileRoute("/sv/tatuerare-malmo")({
  head: () => cityHead("malmo"),
  component: () => <SvCityPage slug="malmo" />,
});
