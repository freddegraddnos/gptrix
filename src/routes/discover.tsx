import { createFileRoute, redirect } from "@tanstack/react-router";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/discover")({
  head: () => seo({ path: "/discover", title: "Discover Tattoo Designs, Studios & Community | InkSimulator", description: "Discover free tattoo designs by style, flash from approved studios, studios near you and the InkSimulator community feed — and try any design on your skin.", breadcrumb: "Discover" }),
  beforeLoad: () => {
    throw redirect({ to: "/library" });
  },
});
