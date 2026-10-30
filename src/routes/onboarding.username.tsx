import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AtSign, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/onboarding/username")({
  head: () => ({
    meta: [
      { title: "Choose Your Username — InkSimulator" },
      {
        name: "description",
        content:
          "Choose your @username on InkSimulator. It becomes the address of your public profile and is used when you share your AR try-ons.",
      },
      { property: "og:title", content: "Choose Your Username — InkSimulator" },
      {
        property: "og:description",
        content: "Ett unikt @namn som blir din publika InkSimulator-profil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsernameOnboarding,
});

export function suggestUsername(seed: string): string {
  const base = seed
    .split("@")[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  if (base.length >= 3) return base;
  return `ink_${Math.random().toString(36).slice(2, 8)}`;
}

const RE = /^[A-Za-z0-9_]{3,20}$/;

function UsernameOnboarding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "free" | "taken">("idle");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (seeded.current) return;
    seeded.current = true;
    const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
    setValue(suggestUsername(meta?.full_name || meta?.name || user.email || ""));
  }, [user, loading, navigate]);

  const formatError = useMemo(() => {
    if (!value) return "Enter a username.";
    if (value.length < 3) return "At least 3 characters.";
    if (value.length > 20) return "Max 20 characters.";
    if (!RE.test(value)) return "Only letters, numbers, and underscores.";
    return null;
  }, [value]);

  // Real-time check against the database as the user types.
  useEffect(() => {
    if (formatError) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_handle_available", {
        _handle: value,
      });
      if (cancelled) return;
      if (error) setStatus("idle");
      else setStatus(data ? "free" : "taken");
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, formatError]);

  const confirm = async () => {
    if (!user || formatError || status !== "free") return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({ handle: value, username_set: true })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setErr(
        error.code === "23505"
          ? "That username is taken."
          : "Could not save the username. Please try again.",
      );
      setStatus("taken");
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <AppShell showNav={false}>
      <div className="min-h-[calc(100dvh-4rem)] flex flex-col">
        <div className="text-mono-caps text-[10px] text-accent">Step 1 of 2</div>
        <h1 className="mt-2 text-3xl font-display font-bold tracking-tight text-balance">
          Choose your username
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This becomes the address of your profile — inksimulator.com/@{value || "yourname"} — and
          shows up when you share try-ons and votes.
        </p>

        <div className="mt-6">
          <div
            className={`flex items-center gap-2 h-14 rounded-2xl bg-slate border px-4 transition ${
              touched && (formatError || status === "taken")
                ? "border-red-500/60"
                : status === "free"
                  ? "border-accent/70"
                  : "border-white/10"
            }`}
          >
            <AtSign className="size-4 text-muted-foreground shrink-0" />
            <input
              value={value}
              onChange={(e) => {
                setTouched(true);
                setValue(e.target.value.replace(/\s/g, "").slice(0, 20));
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourname"
              aria-label="Username"
              className="flex-1 bg-transparent text-base font-bold outline-none placeholder:text-muted-foreground"
            />
            {status === "checking" && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {status === "free" && <Check className="size-4 text-accent" />}
            {status === "taken" && <X className="size-4 text-red-400" />}
          </div>

          <div className="mt-2 min-h-5 text-xs">
            {touched && formatError ? (
              <span className="text-red-400">{formatError}</span>
            ) : status === "free" ? (
              <span className="text-accent font-bold">Available</span>
            ) : status === "taken" ? (
              <span className="text-red-400 font-bold">Taken</span>
            ) : (
              <span className="text-muted-foreground">
                3–20 characters · letters, numbers, and underscores
              </span>
            )}
          </div>
          {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
        </div>

        <button
          onClick={confirm}
          disabled={saving || !!formatError || status !== "free"}
          className="mt-6 h-14 rounded-2xl bg-accent text-ink font-bold text-sm uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Continue
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground">
          You can change the name later in profile settings.
        </p>
      </div>
    </AppShell>
  );
}
