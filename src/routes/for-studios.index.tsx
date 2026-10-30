import { createFileRoute } from "@tanstack/react-router";
import { ForStudiosPage } from "@/components/ForStudiosPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/for-studios/")({
  head: () => seo({ path: "/for-studios", title: "Your Studio Page & Session Booking | InkSimulator", description: "Update your studio page and plan tattoo sessions for clients to book through a link. Free trial throughout 2026 with no fixed studio fee or commission.", breadcrumb: "For studios", lang: "en", extraLinks: [
    { rel: "alternate", hrefLang: "en", href: "https://www.inksimulator.com/for-studios" },
    { rel: "alternate", hrefLang: "sv", href: "https://www.inksimulator.com/sv/for-studios" },
    { rel: "alternate", hrefLang: "x-default", href: "https://www.inksimulator.com/for-studios" },
  ] }),
  component: () => <ForStudiosPage lang="en" />,
});
