import { useEffect, useState } from "react";
import { Bell, BellOff, Mail, Plus, Trash2, Send, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { currentPushSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";
import { runNotificationTest } from "@/lib/notifications.functions";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
const EVENTS = [
  { key: "on_confirmation", label: "Booking confirmations" },
  { key: "on_reminder", label: "Reminders before the session" },
  { key: "on_change", label: "Changes & cancellations" },
  { key: "on_scan", label: "3D scan uploads & delivery status" },
  { key: "on_message", label: "New messages" },
] as const;

const REMINDER_OPTIONS = [2, 6, 24, 48];

type TestKind = "confirmation" | "reminder" | "change";

const TEST_KINDS: { key: TestKind; label: string }[] = [
  { key: "confirmation", label: "Confirmation" },
  { key: "reminder", label: "Reminder" },
  { key: "change", label: "Change" },
];

interface TestResult {
  role: string;
  email: string | null;
  kind: string;
  delivered: boolean;
  channels: { channel: string; target: string; ok: boolean; reason?: string }[];
  reason?: string;
}

const REASON_TEXT: Record<string, string> = {
  email_off: "Email is turned off",
  push_off: "Push is turned off",
  no_registered_device: "No device registered for push",
  recipient_suppressed: "Address unsubscribed or bounced",
  muted_by_prefs: "Turned off in preferences",
  not_sent: "Not delivered",
};

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2.5 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-ink transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function NotificationSettings({ userId }: { userId: string | undefined }) {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const { prefs, loading, save } = useNotificationPrefs(userId);
  const [pushDevice, setPushDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [testKinds, setTestKinds] = useState<TestKind[]>([
    "confirmation",
    "reminder",
    "change",
  ]);
  const [includePartner, setIncludePartner] = useState(true);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const supported = pushSupported();

  useEffect(() => {
    void currentPushSubscription().then((s) => setPushDevice(Boolean(s)));
  }, []);

  const togglePush = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        const res = await enablePush();
        if (!res.ok) {
          toast.error(res.error ?? tr("Could not enable push notifications", "Kunde inte aktivera push-aviseringar"));
          return;
        }
        setPushDevice(true);
        await save({ push_enabled: true });
        toast.success(tr("Push notifications on for this device", "Push-aviseringar är aktiverade på den här enheten"));
      } else {
        await disablePush();
        setPushDevice(false);
        await save({ push_enabled: false });
        toast.success(tr("Push notifications off", "Push-aviseringar är avstängda"));
      }
    } catch {
      toast.error(tr("Could not update push notifications", "Kunde inte uppdatera push-aviseringar"));
    } finally {
      setBusy(false);
    }
  };

  const addEmail = async () => {
    const value = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error(tr("Enter a valid email address", "Ange en giltig e-postadress"));
      return;
    }
    if (prefs.extra_emails.includes(value)) {
      toast.error(tr("That address is already added", "Adressen är redan tillagd"));
      return;
    }
    if (prefs.extra_emails.length >= 5) {
      toast.error(tr("Up to 5 extra addresses", "Högst 5 extra adresser"));
      return;
    }
    await save({ extra_emails: [...prefs.extra_emails, value] });
    setNewEmail("");
    toast.success(tr("Address added", "Adressen har lagts till"));
  };

  const removeEmail = async (email: string) => {
    await save({ extra_emails: prefs.extra_emails.filter((e) => e !== email) });
  };

  const toggleKind = (kind: TestKind) =>
    setTestKinds((cur) =>
      cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind],
    );

  const test = async () => {
    if (testKinds.length === 0) {
      toast.error(tr("Pick at least one event to test", "Välj minst en händelse att testa"));
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const res = await runNotificationTest({
        data: { kinds: testKinds, includePartner },
      });
      setResults(res.results);
      const ok = res.results.filter((r) => r.delivered).length;
      if (ok === 0) toast.error(tr("Nothing was delivered — check the status list below", "Inget levererades — kontrollera statuslistan nedan"));
      else toast.success(tr(`${ok} of ${res.results.length} test notifications delivered`, `${ok} av ${res.results.length} testaviseringar levererades`));
    } catch {
      toast.error(tr("Could not run the notification test", "Kunde inte köra aviseringstestet"));
    } finally {
      setBusy(false);
    }
  };

  if (!userId) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate p-4">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="size-4 text-accent" />
        <h2 className="font-bold">{tr("Notifications", "Aviseringar")}</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        {tr("Choose how and where you get booking confirmations, reminders and changes.", "Välj hur och var du får bokningsbekräftelser, påminnelser och ändringar.")}
      </p>

      {loading ? (
        <div className="text-xs text-muted-foreground py-4">{tr("Loading…", "Laddar…")}</div>
      ) : (
        <>
          <div className="divide-y divide-white/5">
            <Toggle
              label={tr("Email", "E-post")}
              hint={tr("Sent to your account address and any extra addresses below.", "Skickas till kontots adress och extra adresser nedan.")}
              checked={prefs.email_enabled}
              onChange={(v) => void save({ email_enabled: v })}
            />
            <Toggle
              label={tr("In-app notifications", "Aviseringar i appen")}
              hint={tr("Shows updates in the bell and the notifications page.", "Visar uppdateringar under klockan och på aviseringssidan.")}
              checked={prefs.inapp_enabled}
              onChange={(v) => void save({ inapp_enabled: v })}
            />
            <Toggle
              label={tr("Push notifications", "Push-aviseringar")}
              hint={
                supported
                  ? pushDevice
                    ? tr("This device is registered.", "Den här enheten är registrerad.")
                    : tr("Turn on to register this device.", "Aktivera för att registrera enheten.")
                  : tr("Not supported here — install the app to your home screen first.", "Stöds inte här — installera först appen på hemskärmen.")
              }
              checked={prefs.push_enabled && pushDevice}
              disabled={!supported || busy}
              onChange={(v) => void togglePush(v)}
            />
          </div>

          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
              {tr("Send me", "Skicka till mig")}
            </div>
            <div className="divide-y divide-white/5">
              {EVENTS.map((e) => (
                <Toggle
                  key={e.key}
                  label={lang === "sv" ? ({
                    on_confirmation: "Bokningsbekräftelser",
                    on_reminder: "Påminnelser före besöket",
                    on_change: "Ändringar och avbokningar",
                    on_scan: "3D-skanningar och leveransstatus",
                    on_message: "Nya meddelanden",
                  } as const)[e.key] : e.label}
                  checked={prefs[e.key]}
                  onChange={(v) => void save({ [e.key]: v })}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
              {tr("Quiet hours", "Tysta timmar")}
            </div>
            <Toggle
              label={tr("Do not disturb", "Stör ej")}
              hint={tr(`Pause notifications between these hours (${prefs.quiet_tz}).`, `Pausa aviseringar mellan dessa tider (${prefs.quiet_tz}).`)}
              checked={prefs.quiet_enabled}
              onChange={(v) =>
                void save({ quiet_enabled: v, quiet_tz: prefs.quiet_tz || "UTC" })
              }
            />
            {prefs.quiet_enabled && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex-1 text-xs text-muted-foreground">
                     {tr("From", "Från")}
                    <input
                      type="time"
                      value={prefs.quiet_start}
                      onChange={(e) => void save({ quiet_start: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-ink/60 px-2 text-xs text-foreground"
                    />
                  </label>
                  <label className="flex-1 text-xs text-muted-foreground">
                     {tr("To", "Till")}
                    <input
                      type="time"
                      value={prefs.quiet_end}
                      onChange={(e) => void save({ quiet_end: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-ink/60 px-2 text-xs text-foreground"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  {(
                    [
                      { key: "push", label: tr("Push only", "Endast push") },
                      { key: "inapp", label: tr("In-app only", "Endast i appen") },
                      { key: "both", label: tr("Both", "Båda") },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => void save({ quiet_scope: o.key })}
                      className={`flex-1 h-9 rounded-lg text-[11px] font-bold border ${
                        prefs.quiet_scope === o.key
                          ? "bg-accent text-ink border-accent"
                          : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      {tx(o.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
              {tr("Remind me", "Påminn mig")}
            </div>
            <div className="flex gap-2">
              {REMINDER_OPTIONS.map((h) => (
                <button
                  key={h}
                  onClick={() => void save({ reminder_hours: h })}
                  className={`flex-1 h-9 rounded-lg text-[11px] font-bold border ${
                    prefs.reminder_hours === h
                      ? "bg-accent text-ink border-accent"
                      : "border-white/10 text-muted-foreground"
                  }`}
                >
                  {lang === "sv" ? `${h} h före` : `${h}h before`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
               {tr("Extra email addresses", "Extra e-postadresser")}
            </div>
            <ul className="space-y-1.5 mb-2">
              {prefs.extra_emails.map((email) => (
                <li
                  key={email}
                  className="flex items-center gap-2 text-xs bg-ink/60 border border-white/5 rounded-lg px-3 h-9"
                >
                  <Mail className="size-3 text-accent shrink-0" />
                  <span className="truncate flex-1">{email}</span>
                  <button
                    onClick={() => void removeEmail(email)}
                    aria-label={tr(`Remove ${email}`, `Ta bort ${email}`)}
                    className="text-red-300"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                type="email"
                inputMode="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={tx("studio@example.com")}
                aria-label={tx("Extra email address")}
                className="flex-1 h-9 rounded-lg bg-ink/60 border border-white/10 px-3 text-xs"
              />
              <button
                onClick={() => void addEmail()}
                className="h-9 px-3 rounded-lg bg-accent text-ink font-bold text-[10px] uppercase tracking-widest flex items-center gap-1"
              >
                 <Plus className="size-3" /> {tr("Add", "Lägg till")}
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
              {tr("Test notifications", "Testa aviseringar")}
            </div>
            <div className="flex gap-2 mb-2">
              {TEST_KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => toggleKind(k.key)}
                  aria-pressed={testKinds.includes(k.key)}
                  className={`flex-1 h-9 rounded-lg text-[11px] font-bold border ${
                    testKinds.includes(k.key)
                      ? "bg-accent text-ink border-accent"
                      : "border-white/10 text-muted-foreground"
                  }`}
                >
                    {lang === "sv" ? ({ confirmation: "Bekräftelse", reminder: "Påminnelse", change: "Ändring" } as const)[k.key] : k.label}
                </button>
              ))}
            </div>
            <Toggle
              label={tr("Include the other party", "Inkludera den andra parten")}
              hint={tr("Also sends to the studio or client from your latest booking.", "Skickar även till studion eller kunden från den senaste bokningen.")}
              checked={includePartner}
              onChange={setIncludePartner}
            />
            <button
              onClick={() => void test()}
              disabled={busy}
              className="mt-1 w-full h-10 rounded-xl bg-accent text-ink font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {tr("Run test", "Kör test")}
            </button>

            {results && (
              <ul className="mt-3 space-y-1.5">
                {results.map((r, i) => (
                  <li
                    key={`${r.role}-${r.kind}-${i}`}
                    className="rounded-lg border border-white/10 bg-ink/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {r.delivered ? (
                        <Check className="size-3.5 text-accent shrink-0" />
                      ) : (
                        <X className="size-3.5 text-red-300 shrink-0" />
                      )}
                      <span className="font-bold capitalize">{r.kind}</span>
                      <span className="text-muted-foreground truncate">
                        → {r.role}
                        {r.email ? ` · ${r.email}` : ""}
                      </span>
                    </div>
                    <div className="mt-1 pl-5 text-[10px] text-muted-foreground">
                      {r.reason
                        ? (REASON_TEXT[r.reason] ?? r.reason)
                        : r.channels
                            .map(
                              (c) =>
                                `${c.channel}: ${
                                  c.ok ? "delivered" : (REASON_TEXT[c.reason ?? ""] ?? c.reason ?? "failed")
                                }`,
                            )
                            .join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!supported && (
            <p className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1.5">
              <BellOff className="size-3" /> {tr("On iPhone, add InkSimulator to your home screen to allow push.", "På iPhone behöver InkSimulator läggas på hemskärmen för att tillåta push.")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
