import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Mail, Loader2, Check, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { setRememberMe, getRememberMe } from "@/lib/authSession";
import { signUpWithUsername, signInWithUsername } from "@/lib/usernameAuth.functions";
import { isValidUsername } from "@/lib/usernameAuth";
import { safeRedirect, setPendingRedirect, takePendingRedirect, peekPendingRedirect } from "@/lib/authRedirect";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: tx("Log in — InkSimulator") },
      {
        name: "description",
        content:
          "One button to get started. Google or a magic link via email — no password needed.",
      },
      { property: "og:title", content: "Log in — InkSimulator" },
      {
        property: "og:description",
        content: "Continue with Google or a magic link.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string; mode?: "signup" } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    mode: s.mode === "signup" ? "signup" : undefined,
  }),
  component: Auth,
});

function Auth() {
  useUiLang();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { redirect, mode } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "google" | "magic" | "password" | "reset">(null);
  const [magicSent, setMagicSent] = useState(false);
  const [method, setMethod] = useState<"username" | "email" | "magic">("username");
  const [remember, setRemember] = useState(true);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [uname, setUname] = useState("");
  const [upass, setUpass] = useState("");
  const [phone, setPhone] = useState("");
  const [adult, setAdult] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [uMode, setUMode] = useState<"in" | "up">(mode === "signup" ? "up" : "in");

  const submitUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const isEmail = uMode === "in" && uname.includes("@");
    if (!isEmail && !isValidUsername(uname)) {
      setErr(tx("Username: 3–20 letters, numbers or _"));
      return;
    }
    if (upass.length < 8) {
      setErr(tx("Password must be at least 8 characters"));
      return;
    }
    setLoading("password");
    setRememberMe(remember);
    try {
      if (uMode === "up") {
        const r = await signUpWithUsername({ data: { username: uname, password: upass, email, phone, adult, redirectOrigin: window.location.origin, redirectPath: safeRedirect(redirect) ?? peekPendingRedirect() } });
        if (!r.ok) throw new Error(r.error);
        // signup_completed — account created, confirmation email sent
        void import("@/lib/track").then((t) => t.track("signup_completed"));
        setSignupSent(true);
        return;
      }
      if (isEmail) {
        const { error } = await supabase.auth.signInWithPassword({ email: uname.trim(), password: upass });
        if (error) throw new Error(tx("Wrong email or password."));
        return;
      }
      const r = await signInWithUsername({ data: { username: uname, password: upass } });
      if (!r.ok) throw new Error(r.error);
      const { error } = await supabase.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken });
      if (error) throw error;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    setRemember(getRememberMe());
  }, []);

  // Keep the intended destination across an OAuth / magic-link round trip.
  useEffect(() => {
    setPendingRedirect(redirect);
  }, [redirect]);

  useEffect(() => {
    if (user) {
      const remembered = takePendingRedirect();
      const explicit = safeRedirect(redirect) ?? remembered;
      if (explicit) { navigate({ to: explicit as never }); return; }
      void (async () => {
        const { data: own } = await supabase.from("artist_profiles").select("id").eq("user_id", user.id).maybeSingle();
        const { data: member } = own ? { data: null } : await supabase.from("studio_members").select("id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
        navigate({ to: (own || member ? "/artists/dashboard" : "/profile") as never });
      })();
    }
  }, [user, navigate, redirect]);

  /** Public same-origin URL we come back to after an external login. */
  const returnUrl = () => {
    const target = safeRedirect(redirect) ?? peekPendingRedirect();
    return `${window.location.origin}/auth${
      target ? `?redirect=${encodeURIComponent(target)}` : ""
    }`;
  };

  const signInGoogle = async () => {
    setErr(null);
    setLoading("google");
    setRememberMe(remember);
    setPendingRedirect(redirect);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: returnUrl(),
      });
      if (result.error) throw new Error(String(result.error.message ?? result.error));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  };

  const sendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading("magic");
    setRememberMe(remember);
    setPendingRedirect(redirect);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: returnUrl(),
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send the link");
    } finally {
      setLoading(null);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading("password");
    setRememberMe(remember);
    try {
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) throw signIn.error;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wrong email or password");
    } finally {
      setLoading(null);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading("reset");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send the reset email");
    } finally {
      setLoading(null);
    }
  };

  if (resetMode) {
    return (
      <AppShell showNav={false}>
        <div className="min-h-[60dvh] flex flex-col justify-center">
          <div className="text-mono-caps text-[10px] text-accent">{tx("Password")}</div>
          <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">
            {tx("Forgot your password?")}
          </h1>
          {resetSent ? (
            <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 p-5 text-center">
              <div className="size-12 mx-auto rounded-full bg-accent/20 grid place-items-center">
                <Check className="size-6 text-accent" strokeWidth={3} />
              </div>
              <div className="mt-3 font-display font-bold text-lg">{tx("Check your inbox")}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {tx("We sent a reset link to")}{" "}
                <span className="text-foreground font-bold">{email}</span>{tx(". Open it to choose a new password.")}
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                {tx("Enter your email and we'll send you a link to set a new one.")}
              </p>
              <form onSubmit={sendReset} className="mt-6 space-y-3">
                <div className="flex items-center gap-2 h-14 rounded-2xl bg-slate border border-white/10 px-4 focus-within:border-accent">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tx("you@example.com")}
                    className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading !== null || !email}
                  className="w-full h-14 rounded-2xl bg-accent text-ink font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading === "reset" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    tx("Send reset link")
                  )}
                </button>
              </form>
            </>
          )}
          {err && (
            <p className="mt-3 text-[12px] text-destructive text-center" role="alert">
              {err}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setResetSent(false);
              setErr(null);
            }}
            className="mt-6 text-[10px] uppercase tracking-widest text-muted-foreground"
          >
            {tx("Back to sign in")}
          </button>
        </div>
      </AppShell>
    );
  }

  const field = "w-full h-12 rounded-2xl bg-slate border border-white/10 px-4 text-[15px] outline-none focus:border-accent";
  const lbl = "block text-[12px] font-medium text-foreground mb-1";
  const methods: { id: "username" | "email" | "magic"; label: string }[] = [
    { id: "username", label: tx("Username") },
    { id: "email", label: tx("Email & password") },
    { id: "magic", label: tx("Email link") },
  ];

  return (
    <AppShell showNav={false}>
      <div className="min-h-[calc(100dvh-4rem)] flex flex-col">
        <div className="text-mono-caps text-[10px] text-accent">{tx("Get started")}</div>
        <h1 className="mt-1.5 text-3xl font-display font-bold tracking-tight text-balance">
          {method === "username" && uMode === "up" ? tx("Create your account") : tx("Log in")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tx("Log in with your username and password, or choose another way below.")}
        </p>

        {method === "username" && (
          <form onSubmit={submitUsername} className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate p-1 text-[13px]" role="tablist" aria-label={tx("Log in or create account")}>
              {(["in", "up"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={uMode === m}
                  onClick={() => { setUMode(m); setSignupSent(false); setErr(null); /* signup_started — user picks "Create account" */ if (m === "up") void import("@/lib/track").then((t) => t.track("signup_started")); }}
                  className={`h-10 rounded-xl ${uMode === m ? "bg-accent text-ink font-bold" : "text-muted-foreground"}`}
                >
                  {m === "in" ? tx("Log in") : tx("Create account")}
                </button>
              ))}
            </div>
            {signupSent && <p role="status" className="rounded-md border border-accent p-3 text-sm">{tx("Check your email to confirm your account. Then log in with your username and password.")}</p>}
            <div>
              <label htmlFor="auth-username" className={lbl}>{uMode === "in" ? tx("Username or email") : tx("Username")}</label>
              <input id="auth-username" name="username" value={uname} required onChange={(e) => setUname(e.target.value)} autoComplete="username" autoCapitalize="none" className={field} />
            </div>
            <div>
              <label htmlFor="auth-upass" className={lbl}>{tx("Password")}{" "}{uMode === "up" && <span className="text-muted-foreground">{tx("(at least 8 characters)")}</span>}</label>
              <input id="auth-upass" name="password" type="password" required value={upass} onChange={(e) => setUpass(e.target.value)} autoComplete={uMode === "up" ? "new-password" : "current-password"} className={field} />
            </div>
            {uMode === "up" && <>
              <div>
                <label htmlFor="auth-signup-email" className={lbl}>{tx("Email")}</label>
                <input id="auth-signup-email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="auth-phone" className={lbl}>{tx("Phone")}{" "}<span className="text-muted-foreground">{tx("(optional)")}</span></label>
                <input id="auth-phone" name="tel" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
              </div>
              <label className="flex items-start gap-2.5 text-[11px] leading-snug"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 size-3.5 shrink-0 accent-[color:var(--accent)]" /><span>{tx("I am 18 or older. You can create an account at any age, but must be 18+ to send a booking to a tattoo artist.")}</span></label>
              <p className="text-[11px] text-muted-foreground">{tx("We use your email and optional phone for booking notifications.")}</p>
            </>}
            <button type="submit" disabled={loading !== null || !uname || !upass} className="w-full h-12 rounded-2xl bg-accent text-ink font-bold text-[15px] flex items-center justify-center disabled:opacity-60">
              {loading === "password" ? <Loader2 className="size-5 animate-spin" /> : uMode === "in" ? tx("Log in") : tx("Create account")}
            </button>
            {uMode === "up" && <p className="text-[11px] text-muted-foreground text-center">{tx("Confirm your email before logging in.")}</p>}
          </form>
        )}

        {method === "email" && (
          <form onSubmit={submitPassword} className="mt-5 space-y-3">
            <div>
              <label htmlFor="auth-email" className={lbl}>{tx("Email")}</label>
              <input id="auth-email" name="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="auth-password" className={lbl}>{tx("Password")}</label>
              <input id="auth-password" name="password" type="password" required minLength={6} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            </div>
            <button type="submit" disabled={loading !== null || !email || !password} className="w-full h-12 rounded-2xl bg-accent text-ink font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60">
              {loading === "password" ? <Loader2 className="size-5 animate-spin" /> : tx("Log in")}
            </button>
            <button type="button" onClick={() => { setResetMode(true); setErr(null); }} className="w-full min-h-11 text-[13px] text-accent">
              {tx("Forgot password?")}
            </button>
          </form>
        )}

        {method === "magic" && (magicSent ? (
          <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 p-5 text-center" role="status">
            <div className="size-12 mx-auto rounded-full bg-accent/20 grid place-items-center">
              <Check className="size-6 text-accent" strokeWidth={3} />
            </div>
            <div className="mt-3 font-display font-bold text-lg">{tx("Check your inbox")}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {tx("We sent a link to")}{" "}<span className="text-foreground font-bold">{email}</span>{tx(". Open it to log in.")}
            </p>
            <button onClick={() => { setMagicSent(false); setEmail(""); }} className="mt-4 min-h-11 text-[13px] text-accent">
              {tx("Send again")}
            </button>
          </div>
        ) : (
          <form onSubmit={sendMagic} className="mt-5 space-y-3">
            <div>
              <label htmlFor="auth-magic-email" className={lbl}>{tx("Email")}</label>
              <div className="flex items-center gap-2 h-12 rounded-2xl bg-slate border border-white/10 px-4 focus-within:border-accent">
                <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <input id="auth-magic-email" name="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent text-[15px] outline-none" />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{tx("We email you a link — no password needed.")}</p>
            </div>
            <button type="submit" disabled={loading !== null || !email} className="w-full h-12 rounded-2xl bg-accent text-ink font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60">
              {loading === "magic" ? <Loader2 className="size-5 animate-spin" /> : tx("Send login link")}
            </button>
          </form>
        ))}

        {err && (
          <p className="mt-3 text-[13px] text-destructive text-center" role="alert">{err}</p>
        )}

        <div className="mt-6">
          <p className="text-[12px] text-muted-foreground mb-2">{tx("Other ways to log in")}</p>
          <div className="space-y-2">
            {methods.filter((m) => m.id !== method).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMethod(m.id); setErr(null); }}
                className="w-full h-12 rounded-2xl border border-white/15 text-foreground font-medium text-[15px] flex items-center justify-center gap-2"
              >
                {m.id === "magic" ? <Mail className="size-4" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
                {m.id === "username" ? tx("Use username") : m.id === "email" ? tx("Use email and password") : tx("Get a login link by email")}
              </button>
            ))}
            <button
              onClick={signInGoogle}
              disabled={loading !== null}
              className="w-full h-12 rounded-2xl bg-white text-ink font-bold text-[15px] flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60"
            >
              {loading === "google" ? <Loader2 className="size-5 animate-spin" /> : <GoogleG />}
              {tx("Continue with Google")}
            </button>
          </div>
        </div>

        <label className="mt-5 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => {
              setRemember(e.target.checked);
              setRememberMe(e.target.checked);
            }}
            className="size-4 accent-[color:var(--accent,#8A5BF2)] rounded"
          />
          {tx("Keep me signed in on this device")}
        </label>

        <p className="mt-8 text-[11px] text-muted-foreground text-center leading-relaxed">
          {tx("By continuing you agree to our")}{" "}
          <Link
            to="/terms"
            className="inline-block py-2 underline text-foreground"
          >
            terms
          </Link>{" "}
          and{" "}
          <Link
            to="/privacy"
            className="inline-block py-2 underline text-foreground"
          >
            {tx("privacy policy")}
          </Link>
          .
          <br />
          {tx("No card details are required to create an account.")}
        </p>

        <Link
          to="/ar"
          className="mt-4 inline-flex min-h-11 items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground"
        >
          {tx("Back to the camera")}
        </Link>
      </div>
    </AppShell>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.44-1.12 2.66-2.39 3.48v2.9h3.86c2.26-2.09 3.58-5.17 3.58-8.62z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.9c-1.07.72-2.44 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.37a7.24 7.24 0 010-4.73V6.53H1.29a11.98 11.98 0 000 10.94l3.98-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.53l3.98 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
