import { createFileRoute } from "@tanstack/react-router";
import { ForStudiosFeaturesPage } from "@/components/ForStudiosFeaturesPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/studio-guide/")({
  head: () => seo({ path: "/studio-guide", title: "Studio Guide — Features & Workflow | InkSimulator", description: "The complete InkSimulator guide for tattoo studios: discovery, AR try-on, sketches, bookings, deposits, Google Calendar and Fortnox integration.", breadcrumb: "Studio guide", lang: "en", extraLinks: [
    { rel: "alternate", hrefLang: "en", href: "https://www.inksimulator.com/studio-guide" },
    { rel: "alternate", hrefLang: "sv", href: "https://www.inksimulator.com/sv/studio-guide" },
    { rel: "alternate", hrefLang: "x-default", href: "https://www.inksimulator.com/studio-guide" },
  ] }),
  component: () => <ForStudiosFeaturesPage lang="en" />,
});