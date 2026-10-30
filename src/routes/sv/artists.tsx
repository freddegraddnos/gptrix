import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { StudioLoginPortal } from "@/components/StudioLoginPortal";

export const Route = createFileRoute("/sv/artists")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () =>
    seo({
      path: "/sv/artists",
      title: "Studioinloggning för tatuerare & studios — InkSimulator",
      description:
        "Logga in i din studiopanel på InkSimulator för bokningar, motiv, kalender och team — eller anmäl studions intresse.",
      breadcrumb: "För tatuerare",
    }),
  component: SwedishStudioLogin,
});

function SwedishStudioLogin() {
  const { redirect } = Route.useSearch();
  return <StudioLoginPortal lang="sv" redirect={redirect} />;
}
