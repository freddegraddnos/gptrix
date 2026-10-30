import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/studio-guide")({
  component: StudioGuideLayout,
});

function StudioGuideLayout() {
  return <Outlet />;
}