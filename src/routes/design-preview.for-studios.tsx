import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ForStudiosPage } from "@/components/ForStudiosPage";

export const Route = createFileRoute("/design-preview/for-studios")({
  validateSearch: (s: Record<string, unknown>) => ({ lang: s.lang === "sv" ? "sv" as const : "en" as const }),
  component: Preview,
});

function Preview() {
  const { lang } = Route.useSearch();
  const navigate = useNavigate();
  return <ForStudiosPage lang={lang} preview onPreviewLang={next => void navigate({ to: "/design-preview/for-studios", search: { lang: next } })} />;
}
