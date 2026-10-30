import { createFileRoute, redirect } from "@tanstack/react-router";

// /artist and /artists were two separate B2B pages. They are now one signup.
export const Route = createFileRoute("/artist")({
  beforeLoad: () => {
    throw redirect({ to: "/artists", replace: true });
  },
});
