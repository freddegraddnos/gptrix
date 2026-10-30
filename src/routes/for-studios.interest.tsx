import { createFileRoute } from "@tanstack/react-router";
import { StudioInterestPage } from "@/components/StudioInterestPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/for-studios/interest")({
  head: () => seo({ path: "/for-studios/interest", title: "Studio Interest Registration | InkSimulator", description: "Register your tattoo studio's interest in InkSimulator and request contact about studio profiles, AR try-on, bookings and administration tools.", breadcrumb: "Studio interest", lang: "en", extraLinks: [
    { rel: "alternate", hrefLang: "en", href: "https://www.inksimulator.com/for-studios/interest" },
    { rel: "alternate", hrefLang: "sv", href: "https://www.inksimulator.com/sv/for-studios/interest" },
    { rel: "alternate", hrefLang: "x-default", href: "https://www.inksimulator.com/for-studios/interest" },
  ] }),
  component: () => <StudioInterestPage lang="en" />,
});