import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const ScanMyBody = lazy(() => import("@/components/ScanMyBody"));

export const Route = createFileRoute("/scan-my-body")({
  head: () => ({
    meta: [
      { title: "Scan My Body — InkSimulator" },
      {
        name: "description",
        content:
          "Guided video scanning of your body part with card calibration for millimeter-accurate tattoo sizing.",
      },
      { property: "og:title", content: "Scan My Body — InkSimulator" },
      {
        property: "og:description",
        content: "One continuous recording: card calibration and guided scanning in the same clip.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanMyBodyPage,
});

function ScanMyBodyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ScanMyBody />
    </Suspense>
  );
}
