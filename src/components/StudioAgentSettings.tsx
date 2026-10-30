import { StudioButton as Button } from "@/components/StudioPrimitives";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveMessageTemplates, decideAgentBooking, getAgentPanel, saveAgentSettings } from "@/lib/agentSettings.functions";

import { tx, useUiLang } from "@/lib/uiLang";
type Tier = { label: string; max_cm: number; price_ore: number; minutes: number };
type Form = {
  enabled: boolean; booking_mode: "direct" | "approve"; pricing_mode: "hourly" | "size" | "service" | "consultation";
  hourly_rate_ore: number | null; size_tiers: Tier[]; min_minutes: number; buffer_minutes: number;
  horizon_days: number; deposit_ore: number | null; knowledge: string; language: "sv" | "en";
};
const DEFAULT: Form = {
  enabled: false, booking_mode: "approve", pricing_mode: "consultation", hourly_rate_ore: null,
  size_tiers: [
    { label: "S", max_cm: 5, price_ore: 100000, minutes: 60 }, { label: "M", max_cm: 10, price_ore: 200000, minutes: 120 },
    { label: "L", max_cm: 20, price_ore: 400000, minutes: 240 }, { label: "XL", max_cm: 40, price_ore: 800000, minutes: 480 },
  ],
  min_minutes: 60, buffer_minutes: 0, horizon_days: 60, deposit_ore: null, knowledge: "", language: "sv",
};
type TplKey = "confirm_sv" | "confirm_en" | "reminder_sv" | "reminder_en";
const TPL_HINT: Record<TplKey, string> = {
  confirm_sv: "Hej {namn}! Din tid hos {studio} är bokad {datum} kl. {tid}, {adress}. Välkommen!",
  confirm_en: "Hi {namn}! Your appointment at {studio} is booked for {datum} at {tid}, {adress}. See you soon!",
  reminder_sv: "Påminnelse: {namn}, du har en tid hos {studio} i morgon {datum} kl. {tid}. Ät ordentligt innan och ta med ID.",
  reminder_en: "Reminder: {namn}, you have an appointment at {studio} tomorrow {datum} at {tid}. Eat well beforehand and bring ID.",
};
type Panel = Awaited<ReturnType<typeof getAgentPanel>>;

const box = "studio-card space-y-3";
const input = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";
const kr = (ore: number | null) => (ore == null ? "" : String(Math.round(ore / 100)));
const ore = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v) * 100)));

export function StudioAgentSettings({ studioId }: { studioId: string }) {
  useUiLang();
  const load = useServerFn(getAgentPanel);
  const save = useServerFn(saveAgentSettings);
  const decide = useServerFn(decideAgentBooking);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [f, setF] = useState<Form>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const saveTpl = useServerFn(saveMessageTemplates);
  const [tpl, setTpl] = useState<Record<TplKey, string>>({ confirm_sv: "", confirm_en: "", reminder_sv: "", reminder_en: "" });

  const refresh = () => load({ data: { studioId } }).then((p) => {
    setPanel(p);
    if (p.settings?.message_templates) setTpl((x) => ({ ...x, ...(p.settings!.message_templates as Record<TplKey, string>) }));
    if (p.settings) setF({ ...DEFAULT, ...(p.settings as unknown as Form), size_tiers: (p.settings.size_tiers as unknown as Tier[]) ?? DEFAULT.size_tiers });
  }).catch(() => toast.error(tx("Could not load the booking agent")));
  useEffect(() => { void refresh(); }, [studioId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const persist = async (next: Form) => {
    setSaving(true);
    try { await save({ data: { studioId, ...next } }); toast.success(tx("Saved")); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  };
  const url = panel?.handle ? `https://www.inksimulator.com/${panel.handle}/agent` : null;

  return (
    <section className="mt-5 space-y-4">
      <div className={box}>
        <p className="text-xs font-bold uppercase text-accent">{tx("Optional support")}</p>
        <h2 className="font-display uppercase text-lg">{tx("Booking agent")}</h2>
        <p className="text-sm text-muted-foreground">{tx("Choose whether your studio wants to use the assistant. It is off by default and does not replace the normal request form.")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tx("Use booking agent")}>
          {[true, false].map((v) => (
            <Button key={String(v)} type="button" role="radio" aria-checked={f.enabled === v}
              onClick={() => { const n = { ...f, enabled: v }; setF(n); void persist(n); }}
              className={`h-10 flex-1 rounded-lg border text-sm font-medium ${f.enabled === v ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
              {v ? tx("Active") : tx("Off")}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{f.enabled ? tx("The agent is active for this studio. Your saved settings below are in use.") : tx("The agent is off. Activate it only if the studio wants to use it.")}</p>
        {url && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{tx("Your link — put it in your Instagram bio, Linktree or website:")}</p>
            <div className="flex flex-wrap gap-2">
              <input readOnly value={url} className={input} aria-label={tx("Agent link")} />
              <Button type="button" variant="outline" className="h-10 px-3 rounded-lg border border-border text-sm" onClick={() => { void navigator.clipboard.writeText(url); toast.success(tx("Link copied")); }}>{tx("Copy")}</Button>
            </div>
            <img alt={tx("QR code for your booking link")} className="size-32 rounded bg-white p-1"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`} />
          </div>
        )}
        {!panel?.handle && panel && <p className="text-sm text-destructive">{tx("Set a public studio name in Profile to get your link.")}</p>}
      </div>

      {f.enabled && <><div className={box}>
        <h3 className="font-display uppercase">{tx("Agent language with customers")}</h3>
        <p className="text-sm text-muted-foreground">{tx("Default language for the agent and for notices to you. The agent detects the language each customer writes in and replies — and sends their confirmation — in that language.")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{tx("This is separate from the panel's interface language, which you choose in the studio menu.")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tx("Agent language with customers")}>
          {(["sv", "en"] as const).map((l) => (
            <Button key={l} type="button" role="radio" aria-checked={f.language === l}
              onClick={() => { const n = { ...f, language: l }; setF(n); void persist(n); }}
              className={`h-10 flex-1 rounded-lg border text-sm ${f.language === l ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
              {l === "sv" ? tx("Svenska") : tx("English")}
            </Button>
          ))}
        </div>
      </div>

      <div className={box}>
        <h3 className="font-display uppercase">{tx("Times & calendar")}</h3>
        <p className="text-sm text-muted-foreground">{tx("The agent only offers the free times you publish under Calendar. Busy times from your connected Google Calendar are blocked automatically, and confirmed bookings are added to it with the customer invited.")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-sm">
          <label>{tx("Min. time (min)")}<input type="number" className={input} value={f.min_minutes} onChange={(e) => set("min_minutes", Number(e.target.value) || 60)} /></label>
          <label>{tx("Buffer (min)")}<input type="number" className={input} value={f.buffer_minutes} onChange={(e) => set("buffer_minutes", Number(e.target.value) || 0)} /></label>
          <label>{tx("Book ahead (days)")}<input type="number" className={input} value={f.horizon_days} onChange={(e) => set("horizon_days", Number(e.target.value) || 60)} /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["approve", "direct"] as const).map((m) => (
            <Button key={m} type="button" onClick={() => set("booking_mode", m)} aria-pressed={f.booking_mode === m}
              className={`h-10 flex-1 rounded-lg border text-sm ${f.booking_mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
              {m === "approve" ? tx("I approve first") : tx("Book directly")}
            </Button>
          ))}
        </div>
      </div></>}

      <div className={box}>
        <h3 className="font-display uppercase">{tx("Pricing")}</h3>
        <select className={input} value={f.pricing_mode} onChange={(e) => set("pricing_mode", e.target.value as Form["pricing_mode"])} aria-label={tx("Pricing mode")}>
          <option value="consultation">{tx("Price after consultation")}</option>
          <option value="hourly">{tx("Hourly rate")}</option>
          <option value="size">{tx("Fixed price per size")}</option>
          <option value="service">{tx("Per service (see Services)")}</option>
        </select>
        {f.pricing_mode === "hourly" && (
          <label className="block text-sm">{tx("Hourly rate (kr)")}<input type="number" className={input} value={kr(f.hourly_rate_ore)} onChange={(e) => set("hourly_rate_ore", ore(e.target.value))} /></label>
        )}
        {(f.pricing_mode === "size" || f.pricing_mode === "hourly") && (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">{tx("Size tiers: up to cm → price (kr) and time (min).")}</p>
            {f.size_tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input className={input} value={t.label} aria-label={tx("Label")} onChange={(e) => set("size_tiers", f.size_tiers.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <input type="number" className={input} value={t.max_cm} aria-label={tx("Max cm")} onChange={(e) => set("size_tiers", f.size_tiers.map((x, j) => j === i ? { ...x, max_cm: Number(e.target.value) || 1 } : x))} />
                <input type="number" className={input} value={kr(t.price_ore)} aria-label={tx("Price kr")} onChange={(e) => set("size_tiers", f.size_tiers.map((x, j) => j === i ? { ...x, price_ore: ore(e.target.value) ?? 0 } : x))} />
                <input type="number" className={input} value={t.minutes} aria-label={tx("Minutes")} onChange={(e) => set("size_tiers", f.size_tiers.map((x, j) => j === i ? { ...x, minutes: Number(e.target.value) || 60 } : x))} />
              </div>
            ))}
          </div>
        )}
        <label className="block text-sm">{tx("Deposit (kr, empty = none)")}<input type="number" className={input} value={kr(f.deposit_ore)} onChange={(e) => set("deposit_ore", ore(e.target.value))} /></label>
        <label className="block text-sm">{tx("What the agent should know (aftercare, age limit, cancellation rules…)")}
          <textarea className="w-full min-h-28 rounded-lg border border-border bg-background p-3 text-sm" maxLength={4000} value={f.knowledge} onChange={(e) => set("knowledge", e.target.value)} />
        </label>
        <Button type="button" disabled={saving} onClick={() => void persist(f)} className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">{tx("Save settings")}</Button>
      </div>

      <div className={box}>
        <h3 className="font-display uppercase">{tx("Texts at booking / Texter vid bokning")}</h3>
        <p className="text-sm text-muted-foreground">{tx("Your own text for the customer's confirmation (SMS + email) and the reminder before the visit. Fields:")}{" "}{tx("{namn}")} {tx("{datum}")} {tx("{tid}")} {tx("{studio}")} {tx("{adress}")}{tx(". Leave empty to use the standard text. The customer gets the version in the language they wrote in.")}</p>
        {(Object.keys(TPL_HINT) as TplKey[]).map((k) => (
          <label key={k} className="block text-sm">
            {k.startsWith("confirm") ? tx("Confirmation") : tx("Reminder")} — {k.endsWith("sv") ? tx("Svenska") : tx("English")}
            <textarea className="mt-1 w-full min-h-20 rounded-lg border border-border bg-background p-3 text-sm" maxLength={600} placeholder={TPL_HINT[k]} value={tpl[k]} onChange={(e) => setTpl((x) => ({ ...x, [k]: e.target.value }))} />
            {!tpl[k] && <Button type="button" variant="outline" className="text-xs underline" onClick={() => setTpl((x) => ({ ...x, [k]: TPL_HINT[k] }))}>{tx("Use suggestion")}</Button>}
          </label>
        ))}
        <Button type="button" className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-medium" onClick={() => saveTpl({ data: { studioId, templates: tpl } }).then(() => toast.success(tx("Texts saved"))).catch((e) => toast.error(String(e.message ?? e)))}>{tx("Save texts")}</Button>
      </div>

      <div className={box}>
        <h3 className="font-display uppercase">{tx("Bookings via agent")}</h3>
        {!panel?.bookings.length && <p className="text-sm text-muted-foreground">{tx("No bookings yet.")}</p>}
        {panel?.bookings.map((b) => (
          <div key={b.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between gap-2"><strong>{b.customer_name}</strong><span className="text-xs uppercase">{b.status}</span></div>
            <div>{new Date(b.starts_at).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })} · {b.duration_minutes} min</div>
            <div className="text-muted-foreground">{[b.placement, b.size_cm && `${b.size_cm} cm`, b.customer_email, b.customer_phone].filter(Boolean).join(" · ")}</div>
            {b.idea && <p>{b.idea}</p>}
            {b.motif_url && <a href={b.motif_url} target="_blank" rel="noreferrer" className="underline">{tx("Motif")}</a>}
            {b.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <Button type="button" className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground" onClick={() => decide({ data: { bookingId: b.id, decision: "confirm" } }).then(refresh).catch((e) => toast.error(String(e.message ?? e)))}>{tx("Approve")}</Button>
                <Button type="button" variant="outline" className="h-9 flex-1 rounded-lg border border-border" onClick={() => decide({ data: { bookingId: b.id, decision: "decline" } }).then(refresh).catch((e) => toast.error(String(e.message ?? e)))}>{tx("Decline")}</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={box}>
        <h3 className="font-display uppercase">{tx("Saved chats")}</h3>
        {!panel?.threads.length && <p className="text-sm text-muted-foreground">{tx("No chats yet.")}</p>}
        {panel?.threads.map((t) => (
          <details key={t.id} className="rounded-lg border border-border p-3 text-sm">
            <summary className="cursor-pointer">{new Date(t.updated_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })} — {t.messages[0]?.content.slice(0, 60) ?? ""}</summary>
            <div className="mt-2 space-y-1">{t.messages.map((m, i) => <p key={i}><strong>{m.role === "user" ? tx("Customer") : tx("Agent")}:</strong> {m.content}</p>)}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
