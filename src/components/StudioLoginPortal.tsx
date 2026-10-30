import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";
import { StudioInterestForm } from "@/components/StudioInterestForm";
import { StudioTrackHeader } from "@/components/StudioTrackHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Check } from "lucide-react";
import { sendStudioInterest } from "@/lib/studioInterest.functions";
import { usePublicStudioLang, type PublicStudioLang } from "@/lib/publicStudioLang";
import { safeRedirect } from "@/lib/authRedirect";
import { hasSavedStudioLang, setStudioLang } from "@/lib/studioLang";

const copy = {
  en: {
    access: "Studio access", login: "Log in", signup: "Create studio account", label: "For artists & studios",
    big: ["SELL YOUR DESIGNS.", "BOOK YOUR TIME."], bigText: "Your work, your clients, your studio. All in one place.",
    studio: "Studio", sentH: "Interest sent.", thanks: (n: string) => `Thanks, ${n}. We received the details for`, willContact: "and will contact you.",
    back: "Back to studio login", loginH: "Your studio, your space.", loginText: "Access your bookings, designs, calendar and team.",
    email: "Email", password: "Password", loginBtn: "Log in →", resetSent: (e: string) => `Reset link sent to ${e}. Open it to choose a new password.`,
    forgot: "Forgot password?", find: "Find artists →", signupH: "Create your studio account.", signupText: "Tell us who to contact. No account or public studio page is created yet.",
    studioName: "Studio name", contact: "Contact person", phone: "Phone number", send: "Send interest →",
    privacy: "We use these details only to contact you about InkSimulator for studios.",
    errInterest: "Could not send your interest form", errEmailFirst: "Enter your email first, then tap “Forgot password”.",
    errReset: "Could not send the reset email", errWrong: "Wrong email or password.", errSignIn: "Could not sign in", langLabel: "Choose language",
  },
  sv: {
    access: "Studioåtkomst", login: "Logga in", signup: "Skapa studiokonto", label: "För tatuerare & studios",
    big: ["SÄLJ DINA MOTIV.", "BOKA DIN TID."], bigText: "Dina verk, dina kunder, din studio. Allt på ett ställe.",
    studio: "Studio", sentH: "Intresse skickat.", thanks: (n: string) => `Tack, ${n}. Vi har tagit emot uppgifterna för`, willContact: "och kontaktar dig.",
    back: "Tillbaka till studioinloggningen", loginH: "Din studio, din plats.", loginText: "Få tillgång till dina bokningar, motiv, kalender och team.",
    email: "E-post", password: "Lösenord", loginBtn: "Logga in →", resetSent: (e: string) => `Återställningslänk skickad till ${e}. Öppna den för att välja ett nytt lösenord.`,
    forgot: "Glömt lösenordet?", find: "Hitta tatuerare →", signupH: "Skapa ditt studiokonto.", signupText: "Berätta vem vi ska kontakta. Inget konto eller offentlig studiosida skapas ännu.",
    studioName: "Studionamn", contact: "Kontaktperson", phone: "Telefonnummer", send: "Skicka intresse →",
    privacy: "Vi använder uppgifterna endast för att kontakta dig om InkSimulator för studios.",
    errInterest: "Kunde inte skicka intresseanmälan", errEmailFirst: "Ange din e-post först och tryck sedan på ”Glömt lösenordet?”.",
    errReset: "Kunde inte skicka återställningsmejlet", errWrong: "Fel e-postadress eller lösenord.", errSignIn: "Kunde inte logga in", langLabel: "Välj språk",
  },
};


export function StudioLoginPortal({ lang, redirect }: { lang: PublicStudioLang; redirect?: string }) {
  const t = copy[lang];
  const navigate = useNavigate();
  const [preferredLang, setLang] = usePublicStudioLang(lang);
  const { user, loading: authLoading } = useAuth();
  const submitInterest = useServerFn(sendStudioInterest);
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [studioName, setStudioName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const home = lang === "sv" ? "/sv/artists" : "/artists";
  const returnTo = safeRedirect(redirect) ?? "/artists/dashboard";

  useEffect(() => {
    if (!authLoading && user) navigate({ to: returnTo as never });
  }, [authLoading, user, navigate, returnTo]);
  useEffect(() => {
    if (!hasSavedStudioLang()) setStudioLang(lang);
  }, [lang]);
  useEffect(() => {
    if (lang === "en" && preferredLang === "sv") void navigate({ to: "/sv/artists", search: redirect ? { redirect } : {}, replace: true });
  }, [lang, preferredLang, navigate, redirect]);

  const chooseLanguage = (next: PublicStudioLang) => {
    setLang(next);
    setStudioLang(next);
    void navigate({ to: next === "sv" ? "/sv/artists" : "/artists", search: redirect ? { redirect } : {} });
  };

  const sendInterest = async (event: React.FormEvent) => {
    event.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await submitInterest({ data: { studioName, contactName, email, phone, website } });
      setSent(true);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : t.errInterest);
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    setErr(null);
    if (!email.trim()) { setErr(t.errEmailFirst); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : t.errReset);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate({ to: returnTo as never });
    } catch (cause) {
      setErr(
        cause instanceof Error && cause.message.toLowerCase().includes("invalid")
          ? t.errWrong
          : cause instanceof Error ? cause.message : t.errSignIn,
      );
    } finally {
      setLoading(false);
    }
  };

  const tab = (value: "login" | "signup", label: string) => (
    <Button type="button" variant="ghost" role="tab" aria-selected={mode === value}
      onClick={() => { setMode(value); setErr(null); }}
      className={`h-12 rounded-none border-b-2 text-sm ${mode === value ? "border-accent text-foreground" : "border-transparent text-muted-foreground"}`}>
      {label}
    </Button>
  );
  const modeTabs = (
    <div className="mt-8 grid grid-cols-2 border-b border-border" role="tablist" aria-label={t.access}>
      {tab("login", t.login)}{tab("signup", t.signup)}
    </div>
  );

  const langSwitch = (
    <div role="group" aria-label={t.langLabel} className="ml-auto flex shrink-0 items-center rounded-full border border-border p-0.5">
      {(["sv", "en"] as const).map((l) => (
        <Button key={l} variant="ghost" type="button" aria-pressed={lang === l} onClick={() => chooseLanguage(l)}
          className={`min-h-11 rounded-full px-2.5 text-xs ${lang === l ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
          {l === "sv" ? "Svenska" : "English"}
        </Button>
      ))}
    </div>
  );

  const portal = (content: ReactNode) => (
    <div lang={lang} className="studio-visual-profile min-h-dvh bg-background font-mono text-foreground lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(440px,5fr)]">
      <div className="hidden min-h-dvh flex-col justify-between border-r border-border p-12 lg:flex xl:p-20">
        <Link to="/" aria-label="InkSimulator — home" className="w-fit"><InkSimulatorLockup imgClassName="h-auto w-44 xl:w-52" /></Link>
        <div>
          <p className="text-xs uppercase text-accent">{t.label}</p>
          <p className="mt-6 max-w-xl font-display text-7xl leading-[1.06] xl:text-8xl">{t.big[0]}<br />{t.big[1]}</p>
          <p className="mt-7 max-w-md text-sm leading-relaxed text-muted-foreground">{t.bigText}</p>
        </div>
      </div>
      <div className="flex min-h-dvh flex-col bg-card">
        <StudioTrackHeader compact lang={lang} onLang={chooseLanguage} login={false} theme back={{ to: lang === "sv" ? "/sv/for-studios" : "/for-studios", label: lang === "sv" ? "Tillbaka till översikten" : "Back to overview" }} />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8 lg:px-8">{content}</main>
      </div>
    </div>
  );

  if (sent)
    return portal(
      <div className="border-t border-accent pt-6">
        <Check className="size-6 text-accent" />
        <h1 className="heading-tool mt-5">{t.sentH}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t.thanks(contactName)} <span className="text-foreground">{studioName}</span> {t.willContact}
        </p>
        <Link to={home} className="btn-secondary mt-8 w-full">{t.back}</Link>
      </div>,
    );

  const findLink = <Link to="/studios" className="btn-link mt-5 w-full justify-center">{t.find}</Link>;

  if (mode === "login")
    return portal(
      <>
        <p className="text-xs uppercase text-accent">{t.label}</p>
        <h1 className="mt-3 heading-tool">{t.loginH}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.loginText}</p>
        {modeTabs}
        <form onSubmit={signIn} className="mt-6 space-y-3">
          <label className="block"><span className="field-label">{t.email}</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} className="field-input" /></label>
          <label className="block"><span className="field-label">{t.password}</span><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.password} className="field-input" /></label>
          <Button type="submit" disabled={loading} className="btn-primary mt-3 h-auto w-full text-[0.9375rem]">
            {loading && <Loader2 className="size-5 animate-spin" />}{t.loginBtn}
          </Button>
        </form>
        {resetSent && <p className="mt-3 text-center text-[13px] text-accent">{t.resetSent(email)}</p>}
        {err && <p className="mt-3 field-error text-center" role="alert">{err}</p>}
        <Button type="button" onClick={sendReset} disabled={loading} variant="ghost" className="btn-link mt-3 w-full justify-center">{t.forgot}</Button>
        <Link to="/auth" search={{ redirect: "/artists/dashboard", mode: "signup" }} className="btn-link mt-3 inline-flex min-h-11 justify-center">{lang === "sv" ? "Skapa studiokonto →" : "Create studio account →"}</Link>
        {findLink}
      </>,
    );

  return portal(
    <>
      <p className="text-xs uppercase text-accent">{t.label}</p>
      <h1 className="mt-3 heading-tool">{t.signupH}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lang === "sv" ? "Bekräfta din e-post, välj vad studion vill börja med och förbered profilen i lugn och ro." : "Confirm your email, choose your studio’s starting goal, and prepare your profile at your own pace."}</p>
      {modeTabs}
      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="text-sm">{lang === "sv" ? "Skapa ett konto med bekräftad e-post och förbered sedan ett privat studioutkast. Studiosidan publiceras först efter granskning." : "Create an account with a confirmed email, then prepare a private studio draft. Publication requires review."}</p>
        <Link to="/auth" search={{ redirect: "/artists/dashboard", mode: "signup" }} className="btn-link mt-3 inline-flex min-h-11">{lang === "sv" ? "Skapa konto →" : "Create account →"}</Link>
      </div>
      <details className="mt-6"><summary className="cursor-pointer py-3 text-sm">{lang === "sv" ? "Frågor innan du börjar? Kontakta oss" : "Questions before you start? Contact us"}</summary><StudioInterestForm lang={lang} /></details>
      {findLink}
    </>,
  );
}
