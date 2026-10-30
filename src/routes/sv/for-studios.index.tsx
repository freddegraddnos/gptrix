import { createFileRoute } from "@tanstack/react-router";
import { ForStudiosPage } from "@/components/ForStudiosPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/sv/for-studios/")({
  head: () => seo({ path: "/sv/for-studios", title: "Din studiosida & sittningsbokning | InkSimulator", description: "Uppdatera din studiosida och planera sittningar som kunden bokar via länk. Gratis provperiod under hela 2026 utan fast studioavgift eller provision.", breadcrumb: "För studios", lang: "sv", extraLinks: [
    { rel: "alternate", hrefLang: "en", href: "https://www.inksimulator.com/for-studios" },
    { rel: "alternate", hrefLang: "sv", href: "https://www.inksimulator.com/sv/for-studios" },
    { rel: "alternate", hrefLang: "x-default", href: "https://www.inksimulator.com/for-studios" },
  ] }),
  component: () => <ForStudiosPage lang="sv" />,
});
