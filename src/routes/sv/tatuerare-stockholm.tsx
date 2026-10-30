import { createFileRoute } from "@tanstack/react-router";
import { SvCityPage, cityHead } from "@/components/SvCityLanding";

export const Route = createFileRoute("/sv/tatuerare-stockholm")({
  head: () => cityHead("stockholm"),
  component: () => <SvCityPage slug="stockholm" />,
});
