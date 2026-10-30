import { createFileRoute, redirect } from "@tanstack/react-router";

// The guided first-run page was removed — /start now sends everyone
// straight into the AR camera.
export const Route = createFileRoute("/start")({
  beforeLoad: () => {
    throw redirect({ to: "/ar" });
  },
});
