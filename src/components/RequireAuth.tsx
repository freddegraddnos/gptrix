import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Loader2, Lock, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

/**
 * Route guard for surfaces that require a signed-in user (bookings, messages).
 * Renders an inline sign-in CTA instead of a hard redirect so the URL survives
 * and the user comes back to the same page after logging in.
 *
 * With `requireVerified`, the surface stays locked until the account e-mail is
 * confirmed — used for booking and messaging so studios always reach a real
 * inbox.
 */
export function RequireAuth({
  children,
  title = "Sign in to continue",
  description = "You need an InkSimulator account to book times and message studios.",
  requireVerified = false,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  requireVerified?: boolean;
}) {
  const { user, loading } = useAuth();
  const href = useRouterState({ select: (s) => s.location.href });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated || loading) {
    return (
      <AppShell>
        <div className="py-24 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="py-12 grid place-items-center">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate/60 p-6 text-center">
          <div className="size-12 mx-auto rounded-full bg-accent/15 grid place-items-center">
            <Lock className="size-5 text-accent" />
          </div>
          <h2 className="mt-4 font-display font-bold text-xl">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <Link
            to="/auth"
            search={{ redirect: href }}
            className="mt-5 btn-primary"
          >
            Sign in
          </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (requireVerified && !user.email_confirmed_at) {
    return (
      <AppShell>
        <div className="py-12 grid place-items-center">
          <VerifyEmailCard email={user.email ?? ""} />
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}

/** Shown instead of the page while the account e-mail is unconfirmed. */
export function VerifyEmailCard({ email }: { email: string }) {
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/profile` },
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success(`Verification e-mail sent to ${email}.`);
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-center">
      <div className="size-12 mx-auto rounded-full bg-amber-400/15 grid place-items-center">
        <MailCheck className="size-5 text-amber-300" />
      </div>
      <h2 className="mt-4 font-display font-bold text-xl">Confirm your e-mail</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Booking and messaging open up as soon as you confirm{" "}
        <span className="text-foreground">{email}</span>. Check your inbox for the
        link from InkSimulator.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <button
          onClick={() => void resend()}
          disabled={sending}
          className="h-12 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest disabled:opacity-50"
        >
          {sending ? "Sending…" : "Resend verification e-mail"}
        </button>
        <button
          onClick={() => window.location.reload()}
          className="h-11 rounded-xl border border-white/15 text-xs font-bold uppercase tracking-widest text-muted-foreground"
        >
          I've confirmed — reload
        </button>
      </div>
    </div>
  );
}
