import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, MailCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, VerifyEmailCard } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/profile/details")({
  head: () => ({
    meta: [
      { title: tx("Your details — InkSimulator") },
      {
        name: "description",
        content:
          "Fill in your name, phone and contact e-mail so studios get the right information with every booking request.",
      },
      { property: "og:title", content: "Your details — InkSimulator" },
      {
        property: "og:description",
        content: "Keep your booking contact information up to date in InkSimulator.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <RequireAuth
      title={tx("Sign in to edit your details")}
      description={tx("Your name and contact information are stored on your account.")}
    >
      <ProfileDetailsPage />
    </RequireAuth>
  ),
});

function ProfileDetailsPage() {
  useUiLang();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adultDeclared, setAdultDeclared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void supabase
      .from("profiles")
      .select("display_name, phone, contact_email, adult_declared_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setName(data?.display_name ?? "");
        setPhone(data?.phone ?? "");
        setContactEmail(data?.contact_email ?? user.email ?? "");
        setAdultDeclared(Boolean(data?.adult_declared_at));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const save = async () => {
    if (!user) return;
    if (name.trim().length < 2) {
      toast.error(tx("Please enter your name."));
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        phone: phone.trim() || null,
        contact_email: contactEmail.trim() || null,
        adult_declared_at: adultDeclared ? new Date().toISOString() : null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(tx("Could not save your details."));
    else toast.success(tx("Saved — studios will see these details on your bookings."));
  };

  const verified = Boolean(user?.email_confirmed_at);

  return (
    <AppShell>
      <header className="mb-5 flex items-center gap-3">
        <Link
          to="/profile"
          aria-label={tx("Back to profile")}
          className="size-10 grid place-items-center rounded-xl border border-white/10 text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">{tx("Your details")}</h1>
          <p className="text-xs text-muted-foreground">
            {tx("Sent to the studio with every booking request.")}
          </p>
        </div>
      </header>

      {!verified && user && (
        <div className="mb-5">
          <VerifyEmailCard email={user.email ?? ""} />
        </div>
      )}

      {verified && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-[12px] text-emerald-300">
          <MailCheck className="size-4" />{" "}{tx("E-mail confirmed — booking and messages are unlocked.")}
        </div>
      )}

      {loading ? (
        <div className="py-16 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-4">
          <div className="flex items-center gap-2 text-mono-caps text-[10px] text-accent">
            <UserRound className="size-3" />{" "}{tx("Contact information")}
          </div>

          <Field label={tx("Full name")} hint={tx("Shown to the studio you book with.")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={tx("Your name")}
              className="h-11 w-full rounded-xl border border-white/10 bg-ink px-3 text-sm outline-none focus:border-accent"
            />
          </Field>

          <Field label={tx("Phone")} hint={tx("Used by the studio for last-minute changes.")}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              maxLength={30}
              placeholder="+46 70 123 45 67"
              className="h-11 w-full rounded-xl border border-white/10 bg-ink px-3 text-sm outline-none focus:border-accent"
            />
          </Field>

          <Field label={tx("Contact e-mail")} hint={tx("Defaults to your account e-mail.")}>
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              type="email"
              maxLength={120}
              placeholder={tx("you@example.com")}
              className="h-11 w-full rounded-xl border border-white/10 bg-ink px-3 text-sm outline-none focus:border-accent"
            />
          </Field>

          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" checked={adultDeclared} onChange={(e) => setAdultDeclared(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[color:var(--accent)]" />
            <span>{tx("I am 18 or older. You can have an account at any age, but must be 18+ to send a booking to a tattoo artist.")}</span>
          </label>
          <p className="text-xs text-muted-foreground">{tx("We use your email and optional phone number to notify you about bookings.")}</p>

          <button
            onClick={() => void save()}
            disabled={saving}
            className="h-12 w-full rounded-xl bg-accent text-ink text-xs font-bold uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? tx("Saving…") : tx("Save details")}
          </button>
        </div>
      )}
    </AppShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
      <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
    </label>
  );
}
