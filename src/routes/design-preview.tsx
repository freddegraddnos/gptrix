import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-preview")({
  head: () => ({ meta: [
    { title: "Design proposal | InkSimulator" },
    { name: "description", content: "Internal visual proposal for InkSimulator identity and components." },
    { property: "og:title", content: "Design proposal | InkSimulator" },
    { property: "og:description", content: "Internal visual proposal for InkSimulator identity and components." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => <Outlet />,
});
