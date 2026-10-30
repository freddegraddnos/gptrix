import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/design-preview/studio-builder")({
  beforeLoad: () => {
    throw redirect({ to: "/artists/dashboard", search: { tab: "profil" } });
  },
  head: () => ({ meta: [
    { title: "Studiosidebyggare – separat prototyp | InkSimulator" },
    { name: "description", content: "Granska en isolerad studiosidebyggare med stilpaket, innehåll, undersidor och mobil- och datorförhandsvisning." },
    { property: "og:title", content: "Studiosidebyggare – separat prototyp | InkSimulator" },
    { property: "og:description", content: "Separat granskningsprototyp utan sparande eller publicering av studiosidor." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
});