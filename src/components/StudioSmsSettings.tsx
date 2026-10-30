import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendTestSms } from "@/lib/sms.functions";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

function useLang(): "sv" | "en" {
  const [lang, setLang] = useState<"sv" | "en">("sv");
  useEffect(() => {
    const v = localStorage.getItem("inkvision.studio-lang");
    if (v === "en") setLang("en");
  }, []);
  return lang;
}

const T = {
  sv: {
    title: "Aviseringar för förfrågningar",
    hint: "Välj hur du får veta när en kund skickar en förfrågan.",
    email: "E-post",
    sms: "SMS",
    phone: "Mobilnummer, t.ex. +46701234567",
    save: "Spara",
    test: "Skicka test-SMS",
    saved: "Sparat",
    bad: "Ange numret med landskod, t.ex. +46701234567",
    sent: "Test-SMS skickat",
    off: "SMS är inte aktiverat än",
    fail: "SMS kunde inte skickas",
    none: "Spara ett mobilnummer först",
  },
  en: {
    title: "Request notifications",
    hint: "Choose how you hear about new client requests.",
    email: "Email",
    sms: "SMS",
    phone: "Mobile number, e.g. +46701234567",
    save: "Save",
    test: "Send test SMS",
    saved: "Saved",
    bad: "Enter the number with country code, e.g. +46701234567",
    sent: "Test SMS sent",
    off: "SMS is not activated yet",
    fail: "SMS could not be sent",
    none: "Save a mobile number first",
  },
};

export function StudioSmsSettings({ userId }: { userId: string }) {
  const t = T[useLang()];
  const test = useServerFn(sendTestSms);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedState, setSavedState] = useState("");
  const currentState = JSON.stringify({ phone, email, sms });
  useUnsavedChangesGuard(savedState !== "" && currentState !== savedState);

  useEffect(() => {
    void supabase
      .from("artist_profiles")
      .select("notify_phone, notify_email_enabled, notify_sms_enabled")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPhone(data.notify_phone ?? "");
        setEmail(data.notify_email_enabled);
        setSms(data.notify_sms_enabled);
        setSavedState(JSON.stringify({ phone: data.notify_phone ?? "", email: data.notify_email_enabled, sms: data.notify_sms_enabled }));
      });
  }, [userId]);

  const save = async () => {
    const p = phone.replace(/[\s-]/g, "");
    if ((sms || p) && !/^\+\d{8,15}$/.test(p)) return toast.error(t.bad);
    setBusy(true);
    const { error } = await supabase
      .from("artist_profiles")
      .update({ notify_phone: p || null, notify_email_enabled: email, notify_sms_enabled: sms })
      .eq("user_id", userId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setPhone(p);
      setSavedState(JSON.stringify({ phone: p, email, sms }));
      toast.success(t.saved);
    }
  };

  const runTest = async () => {
    setBusy(true);
    try {
      const r = await test();
      if (r.ok) toast.success(t.sent);
      else if (r.reason === "not_configured") toast.error(t.off);
      else if (r.reason === "no_number") toast.error(t.none);
      else toast.error(t.fail);
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) =>
    `flex-1 h-10 rounded-xl border text-xs font-bold ${on ? "bg-accent text-ink border-accent" : "border-white/10 text-muted-foreground"}`;

  return (
    <div className="rounded-xl border border-white/10 bg-slate p-4 space-y-3">
      <div>
        <div className="text-sm font-bold">{t.title}</div>
        <div className="text-[11px] text-muted-foreground">{t.hint}</div>
      </div>
      <div className="flex gap-2">
        <button type="button" className={chip(email)} onClick={() => setEmail(!email)} aria-pressed={email}>
          {t.email}
        </button>
        <button type="button" className={chip(sms)} onClick={() => setSms(!sms)} aria-pressed={sms}>
          {t.sms}
        </button>
      </div>
      <input
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t.phone}
        className="w-full h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="flex-1 h-10 rounded-xl bg-accent text-ink text-xs font-bold disabled:opacity-50">
          {t.save}
        </button>
        <button type="button" disabled={busy} onClick={() => void runTest()} className="flex-1 h-10 rounded-xl border border-white/10 text-xs font-bold disabled:opacity-50">
          {t.test}
        </button>
      </div>
    </div>
  );
}
