import { createFileRoute } from "@tanstack/react-router";
import { ForStudiosFeaturesPage } from "@/components/ForStudiosFeaturesPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/sv/studio-guide/")({
  head: () => seo({ path: "/sv/studio-guide", title: "Studioguide — Funktioner och arbetsflöde | InkSimulator", description: "Den kompletta InkSimulator-guiden för tatueringsstudios: synlighet, AR-provning, skisser, bokningar, depositioner, Google Kalender och Fortnox-integration.", breadcrumb: "Studioguide", lang: "sv", extraLinks: [
    { rel: "alternate", hrefLang: "en", href: "https://www.inksimulator.com/studio-guide" },
    { rel: "alternate", hrefLang: "sv", href: "https://www.inksimulator.com/sv/studio-guide" },
    { rel: "alternate", hrefLang: "x-default", href: "https://www.inksimulator.com/studio-guide" },
  ] }),
  component: () => <ForStudiosFeaturesPage lang="sv" />,
});