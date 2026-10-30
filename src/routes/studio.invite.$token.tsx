import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/studio/invite/$token")({
  head: () => ({
    meta: [
      { title: tx("Studio invite — InkSimulator") },
      {
        name: "description",
        content: "Join a tattoo studio team on InkSimulator and manage bookings, gallery and deals.",
      },
      { property: "og:title", content: "Join a studio on InkSimulator" },
      {
        property: "og:description",
        content: "Accept your studio invite to manage the team calendar and gallery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioInvitePage,
});

function StudioInvitePage() {
  useUiLang();
  const { token } = useParams({ from: "/studio/invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || state !== "idle") return;
    setState("working");
    void (async () => {
      const { data, error } = await supabase.rpc("accept_studio_invite", { _token: token });
      const res = (data ?? {}) as { ok?: boolean; error?: string };
      if (error || !res.ok) {
        setState("error");
        setMessage(
          res.error === "not_found"
            ? "This invite has already been used or is no longer valid."
            : "Could not accept the invite. Try again.",
        );
        return;
      }
      setState("done");
    })();
  }, [loading, user, state, token]);

  return (
    <AppShell>
      <TopBar title={tx("Studio invite")} />
      <div className="mt-8 rounded-2xl border border-white/10 bg-slate p-6 text-center">
        <ShieldCheck className="size-8 mx-auto text-accent" />
        <h1 className="mt-3 font-display font-bold text-xl">{tx("Join the studio team")}</h1>
        {!user ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx("Sign in with the e-mail your studio invited, then this invite is accepted automatically.")}
            </p>
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="mt-5 h-12 px-6 rounded-xl bg-accent text-ink font-bold text-sm uppercase tracking-widest"
            >
              {tx("Sign in")}
            </button>
          </>
        ) : state === "working" || state === "idle" ? (
          <p className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />{" "}{tx("Accepting the invite…")}
          </p>
        ) : state === "done" ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx("You're in. You can now manage the studio from the dashboard.")}
            </p>
            <Link
              to="/artists/dashboard"
              className="mt-5 inline-flex h-12 px-6 rounded-xl bg-accent text-ink font-bold text-sm uppercase tracking-widest items-center"
            >
              {tx("Open dashboard")}
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm text-destructive">{message}</p>
        )}
      </div>
    </AppShell>
  );
}
