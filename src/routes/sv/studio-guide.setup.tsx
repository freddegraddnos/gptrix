import { createFileRoute } from "@tanstack/react-router";
import { StudioGuide } from "@/components/ForStudiosGuide";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/sv/studio-guide/setup")({
  component: () => <StudioGuide routeLang="sv" />,
  head: () => seo({
    path: "/sv/studio-guide/setup",
    title: "Kom igång med din InkSimulator-studio — steg för steg",
    description: "Steg-för-steg-guiden till studioprofil, motiv, bokningar, kalender och hur du kommer igång med InkSimulator.",
    breadcrumb: "Kom igång med studion",
    lang: "sv",
  }),
});