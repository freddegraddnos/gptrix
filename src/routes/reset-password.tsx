import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — InkSimulator" },
      {
        name: "description",
        content: "Set a new password for your InkSimulator account after a reset email.",
      },
      { property: "og:title", content: "Choose a new password — InkSimulator" },
      {
        property: "og:description",
        content: "Finish your password reset and get back into InkSimulator.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate({ to: "/profile" }), 1500);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message.toLowerCase().includes("session")
            ? "The reset link has expired. Request a new one from the sign-in page."
            : e.message
          : "Could not update the password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell showNav={false}>
      <div className="min-h-[60dvh] flex flex-col justify-center">
        {done ? (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-6 text-center">
            <div className="size-12 mx-auto rounded-full bg-accent/20 grid place-items-center">
              <Check className="size-6 text-accent" strokeWidth={3} />
            </div>
            <h1 className="mt-3 font-display font-bold text-xl">Password updated</h1>
            <p className="mt-2 text-sm text-muted-foreground">Taking you to your profile…</p>
          </div>
        ) : (
          <>
            <div className="text-mono-caps text-[10px] text-accent">Account</div>
            <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">
              Choose a new password.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick something at least 8 characters long.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <div className="flex items-center gap-2 h-14 rounded-2xl bg-slate border border-white/10 px-4 focus-within:border-accent">
                <KeyRound className="size-4 text-muted-foreground shrink-0" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="flex items-center gap-2 h-14 rounded-2xl bg-slate border border-white/10 px-4 focus-within:border-accent">
                <KeyRound className="size-4 text-muted-foreground shrink-0" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-accent text-ink font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="size-5 animate-spin" />}
                Save new password
              </button>
            </form>
            {err && (
              <p className="mt-3 text-[12px] text-destructive text-center" role="alert">
                {err}
              </p>
            )}
            <Link
              to="/auth"
              className="mt-6 text-[10px] uppercase tracking-widest text-muted-foreground text-center"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
