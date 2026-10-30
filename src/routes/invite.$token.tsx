import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Your tattoo artist has invited you — InkSimulator" },
      {
        name: "description",
        content:
          "Accept the invitation to follow your tattoo design in InkSimulator.",
      },
      { property: "og:title", content: "Invitation from your tattoo artist" },
      {
        property: "og:description",
        content: "Follow your tattoo design in InkSimulator.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || state !== "idle") return;
    setState("working");
    void (async () => {
      const { data, error } = await supabase.rpc("claim_artist_invite", {
        _token: token,
      });
      const res = (data ?? null) as { preview_token?: string } | null;
      if (error || !res?.preview_token) {
        setState("error");
        return;
      }
      setPreviewToken(res.preview_token);
      setState("done");
    })();
  }, [loading, user, state, token]);

  useEffect(() => {
    if (state === "done" && previewToken) {
      navigate({ to: "/p/$token", params: { token: previewToken } });
    }
  }, [state, previewToken, navigate]);

  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-6 text-center">
      <div className="max-w-sm">
        <Sparkles className="mx-auto size-6 text-accent" />
        <h1 className="mt-3 font-display text-2xl font-bold">
          Your tattoo artist has invited you
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to link the design to your InkSimulator account and follow
          the project.
        </p>

        {loading || state === "working" ? (
          <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted-foreground" />
        ) : !user ? (
          <Link
            to="/auth"
            search={{ redirect: `/invite/${token}` }}
            className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 text-sm font-bold text-ink"
          >
            Sign in and accept
          </Link>
        ) : state === "error" ? (
          <p className="mt-6 text-sm text-muted-foreground">
            This invitation is no longer valid.
          </p>
        ) : null}
      </div>
    </main>
  );
}
