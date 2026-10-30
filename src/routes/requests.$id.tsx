import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EnablePushPrompt } from "@/components/EnablePushPrompt";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/requests/$id")({
  head: () => ({ meta: [{ title: tx("My Tattoo Project — InkSimulator") }, { name: "description", content: "Your private tattoo request, conversation, references and quote." }, { property: "og:title", content: "My Tattoo Project — InkSimulator" }, { property: "og:description", content: "Private tattoo project workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <RequireAuth requireVerified title={tx("Sign in to view your tattoo project")} description={tx("Use the InkSimulator account that sent this request.")}><CustomerProjectPage /></RequireAuth>,
});

function CustomerProjectPage() {
  useUiLang(); const { id } = Route.useParams(); const { user } = useAuth(); return <AppShell showNav={false}><Link to="/requests" className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-accent"><ArrowLeft className="size-4" />{tx("My requests")}</Link><EnablePushPrompt userId={user?.id} /><ProjectWorkspace projectId={id} artistMode={false} /></AppShell>; }