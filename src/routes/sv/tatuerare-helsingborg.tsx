import { createFileRoute } from "@tanstack/react-router";
import { SvCityPage, cityHead } from "@/components/SvCityLanding";

export const Route = createFileRoute("/sv/tatuerare-helsingborg")({
  head: () => cityHead("helsingborg"),
  component: () => <SvCityPage slug="helsingborg" />,
});
