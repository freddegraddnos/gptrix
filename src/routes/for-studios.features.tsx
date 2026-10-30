import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/for-studios/features")({
  beforeLoad: () => {
    throw redirect({ to: "/studio-guide", replace: true, statusCode: 301 });
  },
});
