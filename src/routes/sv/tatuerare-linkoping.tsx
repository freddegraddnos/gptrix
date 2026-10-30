import { createFileRoute } from "@tanstack/react-router";
import { SvCityPage, cityHead } from "@/components/SvCityLanding";

export const Route = createFileRoute("/sv/tatuerare-linkoping")({
  head: () => cityHead("linkoping"),
  component: () => <SvCityPage slug="linkoping" />,
});
