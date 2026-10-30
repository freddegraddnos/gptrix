import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/for-studios")({
  component: StudioPagesLayout,
});

function StudioPagesLayout() {
  return <Outlet />;
}