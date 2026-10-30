import { createFileRoute } from "@tanstack/react-router";
import { StudioWorkspacePrototype } from "@/components/StudioWorkspacePrototype";

export const Route = createFileRoute("/design-preview/studio-workspace")({
  head: () => ({
    meta: [
      { title: "Studioarbetsyta – granskningsprototyp | InkSimulator" },
      { name: "description", content: "Separat prototyp för granskning av studions arbetsyta och bokningsinställningar." },
      { property: "og:title", content: "Studioarbetsyta – granskningsprototyp | InkSimulator" },
      { property: "og:description", content: "Separat prototyp för granskning av studions arbetsyta och bokningsinställningar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioWorkspacePrototype,
});