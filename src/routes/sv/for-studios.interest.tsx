import { createFileRoute } from "@tanstack/react-router";
import { StudioInterestPage } from "@/components/StudioInterestPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/sv/for-studios/interest")({
  head: () => seo({ path: "/sv/for-studios/interest", title: "Intresseanmälan för tatueringsstudios | InkSimulator", description: "Anmäl din tatueringsstudios intresse för InkSimulator och be om kontakt om studioprofiler, AR-provning, bokningar och administration.", breadcrumb: "Intresseanmälan för studio", lang: "sv", extraLinks: [
    { rel: "alternate", hrefLang: "en", href: "https://www.inksimulator.com/for-studios/interest" },
    { rel: "alternate", hrefLang: "sv", href: "https://www.inksimulator.com/sv/for-studios/interest" },
    { rel: "alternate", hrefLang: "x-default", href: "https://www.inksimulator.com/for-studios/interest" },
  ] }),
  component: () => <StudioInterestPage lang="sv" />,
});