import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { setSubscribed } from "@/lib/access";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({
    meta: [
      { title: "Payment complete — InkSimulator" },
      { name: "description", content: "Your payment has been completed." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): {
    session_id?: string;
    kind?: string;
  } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    kind: typeof search.kind === "string" ? search.kind : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id, kind } = Route.useSearch();
  const navigate = useNavigate();
  const isPlan = kind === "plan";

  useEffect(() => {
    if (isPlan) {
      // Optimistically grant access — the webhook confirms server-side.
      setSubscribed(true);
      const t = setTimeout(() => navigate({ to: "/ar" }), 2500);
      return () => clearTimeout(t);
    }
  }, [isPlan, navigate]);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="size-20 mx-auto rounded-full bg-accent/15 border border-accent/40 grid place-items-center relative">
          <Check className="size-10 text-accent" strokeWidth={3} />
          <Sparkles className="size-4 text-accent absolute -top-1 -right-1 animate-pulse" />
        </div>
        <div className="text-mono-caps text-[10px] text-accent mt-6">
          {isPlan ? "Access activated" : "Payment complete"}
        </div>
        <h1 className="mt-2 font-display font-bold text-[26px] leading-tight">
          {isPlan ? "Welcome to InkSimulator" : "The motif is yours"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isPlan
            ? "Opening AR mode — try your first tattoo now."
            : session_id
              ? "The motif is now in your library."
              : "Check your library shortly."}
        </p>
        <div className="mt-8 space-y-2">
          <Link
            to={isPlan ? "/ar" : "/library"}
            className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-ink font-bold text-sm"
          >
            {isPlan ? "Open camera" : "Open library"}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/profile"
            className="w-full inline-flex items-center justify-center h-11 rounded-xl border border-white/10 text-foreground font-bold text-sm"
          >
            Go to profile
          </Link>
        </div>
      </div>
    </div>
  );
}
