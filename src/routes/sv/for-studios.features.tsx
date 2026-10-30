import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sv/for-studios/features")({
  beforeLoad: () => {
    throw redirect({ to: "/sv/studio-guide", replace: true, statusCode: 301 });
  },
});
