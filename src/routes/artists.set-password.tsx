import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, markIntentionalSignOut } from "@/hooks/useAuth";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/set-password")({
  head: () => ({
    meta: [
      { title: tx("Choose your password — InkSimulator studio") },
      {
        name: "description",
        content: "Replace the temporary password on your InkSimulator studio account with your own.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SetPassword,
});

function SetPassword() {
  useUiLang();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/artists" });
  }, [authLoading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr(tx("Password must be at least 8 characters."));
      return;
    }
    if (password !== confirm) {
      setErr(tx("Passwords don't match."));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (user) {
        await supabase
          .from("artist_profiles")
          .update({ must_change_password: false })
          .eq("user_id", user.id);
      }
      navigate({ to: "/artists/dashboard" });
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      setErr(
        msg.includes("weak") || msg.includes("easy to guess")
          ? "That password is too easy to guess. Mix letters, numbers and a symbol."
          : msg.includes("current password")
            ? "Your current password is required. Sign out and use the reset link instead."
            : e instanceof Error
              ? e.message
              : "Could not update the password.",
      );
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    markIntentionalSignOut();
    await supabase.auth.signOut();
    navigate({ to: "/artists" });
  };

  return (
    <AppShell showNav={false} studioProfile>
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2 text-accent">
          <KeyRound className="size-4" />
          <span className="text-mono-caps text-[10px]">{tx("Studio setup")}</span>
        </div>
        <h1 className="mt-2 text-2xl font-display font-bold tracking-tight">
          {tx("Choose your own password")}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {tx("You signed in with a temporary password. Pick a new one to open your studio panel.")}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tx("New password (at least 8 characters)")}
            className="w-full h-12 rounded-2xl bg-card border border-border px-4 text-[14px]"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={tx("Repeat new password")}
            className="w-full h-12 rounded-2xl bg-card border border-border px-4 text-[14px]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-accent text-ink font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="size-5 animate-spin" />}
            {tx("Save password")}
          </button>
        </form>

        {err && (
          <p className="mt-3 text-[12px] text-destructive text-center" role="alert">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={signOut}
          className="mt-6 w-full text-[11px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2"
        >
          <LogOut className="size-3" />
          {tx("Sign out")}
        </button>
      </div>
    </AppShell>
  );
}
