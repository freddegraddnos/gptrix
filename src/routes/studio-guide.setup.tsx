import { createFileRoute } from "@tanstack/react-router";
import { StudioGuide } from "@/components/ForStudiosGuide";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/studio-guide/setup")({
  component: () => <StudioGuide routeLang="en" />,
  head: () => seo({
    path: "/studio-guide/setup",
    title: "Studio guide — Set up your InkSimulator studio",
    description: "A step-by-step guide to your studio profile, designs, bookings, calendar and getting started with InkSimulator.",
    breadcrumb: "Studio guide",
  }),
});