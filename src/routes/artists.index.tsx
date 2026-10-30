import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { StudioLoginPortal } from "@/components/StudioLoginPortal";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () =>
    seo({
      path: "/artists",
      title: tx("For Artists & Tattoo Studios — Join InkSimulator"),
      description:
        tx("Tattoo artists and studios: apply to join InkSimulator, receive booking requests with AR try-on previews and manage designs, calendar and clients in one panel."),
      breadcrumb: "For artists",
    }),
  component: EnglishStudioLogin,
});

function EnglishStudioLogin() {
  const { redirect } = Route.useSearch();
  return <StudioLoginPortal lang="en" redirect={redirect} />;
}
