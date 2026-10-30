import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sv/studio-login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/sv/artists",
      search: search.redirect ? { redirect: search.redirect } : {},
      replace: true,
      statusCode: 301,
    });
  },
});