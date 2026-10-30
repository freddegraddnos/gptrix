import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, SearchX, ShieldAlert, TriangleAlert } from "lucide-react";
import { StudioShell } from "@/components/StudioShell";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { getStudioRequestAccess, type StudioRequestAccess } from "@/lib/studioRequestAccess.functions";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/requests/$id")({
  validateSearch: (s: Record<string, unknown>): { tab?: string } => (typeof s.tab === "string" ? { tab: s.tab } : {}),
  head: () => ({ meta: [{ title: tx("Project Workspace — InkSimulator Artist") }, { name: "description", content: "Manage a customer tattoo request, files, conversation and quote." }, { property: "og:title", content: "Project Workspace — InkSimulator" }, { property: "og:description", content: "Private tattoo project workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <RequireAuth requireVerified title={tx("Sign in to open this project")}><ArtistProjectPage /></RequireAuth>,
});

function ArtistProjectPage() {
  useUiLang();
  const { id } = Route.useParams();
  const checkAccess = useServerFn(getStudioRequestAccess);
  const [status, setStatus] = useState<StudioRequestAccess | "loading" | "error">("loading");

  const check = () => {
    setStatus("loading");
    void checkAccess({ data: { requestId: id } })
      .then((result) => setStatus(result.status))
      .catch(() => setStatus("error"));
  };

  useEffect(() => { check(); }, [id, checkAccess]);

  return <StudioShell current="requests" detail title={tx("Client case")}>
    {status === "loading" ? <RequestState icon={Loader2} title={tx("Loading request…")} spin />
      : status === "missing" ? <RequestState icon={SearchX} title={tx("Request not found")} body="This request does not exist or has been removed." />
      : status === "forbidden" ? <RequestState icon={ShieldAlert} title={tx("You do not have access")} body="This request belongs to another studio or account." />
      : status === "error" ? <RequestState icon={TriangleAlert} title={tx("The request could not be loaded")} body="Try again. If the problem continues, return to the request list." retry={check} />
      : <ProjectWorkspace projectId={id} artistMode />}
  </StudioShell>;
}

function RequestState({ icon: Icon, title, body, spin = false, retry }: {
  icon: typeof ShieldAlert;
  title: string;
  body?: string;
  spin?: boolean;
  retry?: () => void;
}) {
  useUiLang();
  return <div className="mx-auto grid min-h-[50dvh] max-w-md place-items-center text-center">
    <div>
      <Icon className={`mx-auto size-7 text-accent ${spin ? "animate-spin" : ""}`} />
      <h1 className="mt-4 font-display text-2xl">{title}</h1>
      {body && <p className="mt-2 text-sm text-muted-foreground">{body}</p>}
      {!spin && <div className="mt-6 flex flex-wrap justify-center gap-2">
        {retry && <Button type="button" onClick={retry}>{tx("Try again")}</Button>}
        <Button asChild type="button" variant="outline"><Link to="/artists/requests"><ArrowLeft className="size-4" />{tx("Back to requests")}</Link></Button>
      </div>}
    </div>
  </div>;
}