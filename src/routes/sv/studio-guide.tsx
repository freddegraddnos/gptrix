import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sv/studio-guide")({
  component: SwedishStudioGuideLayout,
});

function SwedishStudioGuideLayout() {
  return <Outlet />;
}