import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sv/for-studios")({
  component: SwedishStudioPagesLayout,
});

function SwedishStudioPagesLayout() {
  return <Outlet />;
}