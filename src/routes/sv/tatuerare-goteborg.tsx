import { createFileRoute } from "@tanstack/react-router";
import { SvCityPage, cityHead } from "@/components/SvCityLanding";

export const Route = createFileRoute("/sv/tatuerare-goteborg")({
  head: () => cityHead("goteborg"),
  component: () => <SvCityPage slug="goteborg" />,
});
