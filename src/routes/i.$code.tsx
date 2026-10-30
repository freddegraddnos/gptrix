import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Gift, Sparkles } from "lucide-react";
import { stashPendingReferral } from "@/hooks/useReferral";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/i/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `You're invited to InkSimulator — 14 days free` },
      {
        name: "description",
        content:
          "Follow the link and get 14 days of free full access to InkSimulator — 1:1-scale AR tattoo try-on.",
      },
      { property: "og:title", content: `Code ${params.code} — 14 days free InkSimulator` },
      {
        property: "og:description",
        content:
          "A friend is inviting you to InkSimulator. Try tattoos in AR — free for 14 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    stashPendingReferral(code);
  }, [code]);

  useEffect(() => {
    if (loading) return;
    // Signed-in user → home; the pending code redeems on next mount via useRedeemPendingReferral.
    // Signed-out → auth, then back home. The app is free, so there is no paywall.
    const t = setTimeout(() => {
      if (user) navigate({ to: "/", replace: true });
      else navigate({ to: "/auth", search: { redirect: "/" } as never, replace: true });
    }, 1400);
    return () => clearTimeout(t);
  }, [user, loading, navigate]);

  return (
    <div className="min-h-[100dvh] bg-ink text-foreground grid place-items-center px-6">
      <div className="max-w-sm w-full rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent p-8 text-center">
        <div className="mx-auto size-14 rounded-full bg-accent/20 border border-accent/40 grid place-items-center">
          <Gift className="size-6 text-accent" />
        </div>
        <div className="mt-4 text-mono-caps text-[10px] text-accent">Invited</div>
        <h1 className="mt-2 font-display font-bold text-2xl leading-tight text-balance">
          You got 14 days free
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Your friend shared their InkSimulator code{" "}
          <span className="font-mono uppercase text-accent">{code}</span> with
          you. We'll add 14 days of full access automatically.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-accent">
          <Sparkles className="size-3.5 animate-pulse" />
          Taking you there…
        </div>
      </div>
    </div>
  );
}
