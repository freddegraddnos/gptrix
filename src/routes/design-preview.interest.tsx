import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { StudioInterestPage } from "@/components/StudioInterestPage";

export const Route = createFileRoute("/design-preview/interest")({
  validateSearch: (s: Record<string, unknown>) => ({ lang: s.lang === "sv" ? "sv" as const : "en" as const }),
  component: Preview,
});

function Preview() {
  const { lang } = Route.useSearch();
  const navigate = useNavigate();
  return <StudioInterestPage lang={lang} preview onPreviewLang={next => void navigate({ to: "/design-preview/interest", search: { lang: next } })} />;
}
