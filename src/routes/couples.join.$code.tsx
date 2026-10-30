/** Invite landing page — join a partner's couple profile with a code. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HeartHandshake, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useCouple } from "@/hooks/useCouple";

export const Route = createFileRoute("/couples/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a couple profile — InkSimulator" },
      {
        name: "description",
        content:
          "Accept an invite and start collecting matching tattoo designs with your partner or best friend.",
      },
      { property: "og:title", content: "Join a couple profile — InkSimulator" },
      {
        property: "og:description",
        content: "Pair up in InkSimulator and save your matching tattoo designs together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinRoute,
});

function JoinRoute() {
  return (
    <RequireAuth
      title="Sign in to accept the invite"
      description="You need an InkSimulator account to join a couple profile."
    >
      <JoinPage />
    </RequireAuth>
  );
}

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { couple, joinCouple, loading } = useCouple();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await joinCouple(code, displayName);
      toast.success("You're paired up");
      void navigate({ to: "/couples" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <p className="text-mono-caps text-[10px] text-accent flex items-center gap-2">
        <HeartHandshake className="size-3.5" /> Couple invite
      </p>
      <h1 className="mt-2 font-display text-3xl">Matching ink, together</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Join with code{" "}
        <span className="text-foreground tracking-[0.25em]">{code.toUpperCase()}</span> and you both
        see every matching design at the same size.
      </p>

      {loading ? (
        <div className="py-16 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      ) : couple ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate/40 p-5">
          <p className="text-sm">
            You're already in <span className="font-bold">{couple.name}</span>. Leave that profile
            first if you want to join another one.
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/couples" })}
            className="mt-4 h-11 px-5 rounded-full bg-accent text-ink text-[11px] font-bold uppercase tracking-widest"
          >
            Open my couple profile
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name in the profile (optional)"
            maxLength={40}
            className="w-full h-12 rounded-xl border border-white/10 bg-slate/40 px-3 text-sm outline-none focus:border-accent/60"
          />
          <button
            type="button"
            onClick={() => void accept()}
            disabled={busy}
            className="w-full h-12 rounded-full bg-accent text-ink text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Accept invite
          </button>
        </div>
      )}
    </AppShell>
  );
}
