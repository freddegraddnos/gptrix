// Server-only: per-studio booking agent (formerly Calendar Buddy).
import { sendSms } from "./sms.server";
import { studioBookingPath, studioBookingUrl } from "./studioBookingLinks";

const MODEL = "openai/gpt-6-astra";
const TZ = "Europe/Stockholm";

type Tier = { label: string; max_cm: number; price_ore: number; minutes: number };
type InputItem = Record<string, unknown>;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function loadAgentStudio(handle: string): Promise<null | { studio: StudioRow; settings: SettingsRow | null; movedTo?: string }> {
  const sb = await admin();
  const { data: studio } = await sb
    .from("artist_profiles")
    .select("user_id, studio_name, handle, address, city, opening_hours, bio, contact_email, notify_phone, notify_sms_enabled")
    .ilike("handle", handle)
    .eq("approval_status", "approved")
    .eq("status", "approved")
    .maybeSingle();
  if (!studio) {
    // Old address after a rename → tell caller where it moved.
    const { data: moved } = await sb.rpc("resolve_studio_handle", { _handle: handle });
    if (moved && moved.toLowerCase() !== handle.toLowerCase()) {
      const r = await loadAgentStudio(moved);
      return r ? { ...r, movedTo: moved } : null;
    }
    return null;
  }
  const { data: settings } = await sb.from("studio_agent_settings").select("*").eq("studio_id", studio.user_id).maybeSingle();
  return { studio, settings };
}

type StudioRow = { user_id: string; studio_name: string; handle: string | null; address: string | null; city: string | null; opening_hours: string | null; bio: string | null; contact_email: string | null; notify_phone: string | null; notify_sms_enabled: boolean | null };
type SettingsRow = import("@/integrations/supabase/types").Database["public"]["Tables"]["studio_agent_settings"]["Row"];
export type Lang = "sv" | "en";
const asLang = (v: unknown, fb: Lang = "sv"): Lang => (v === "en" || v === "sv" ? v : fb);

const kr = (ore: number | null | undefined) => (ore == null ? null : `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`);

type Settings = SettingsRow;

export function quote(s: Settings, sizeCm: number | null) {
  const tiers = (s.size_tiers as unknown as Tier[]) ?? [];
  const tier = sizeCm != null ? tiers.find((t) => sizeCm <= t.max_cm) ?? tiers[tiers.length - 1] : null;
  let minutes = Math.max(s.min_minutes, tier?.minutes ?? s.min_minutes);
  let price: number | null = null;
  if (s.pricing_mode === "size" && tier) price = tier.price_ore;
  if (s.pricing_mode === "hourly" && s.hourly_rate_ore) price = Math.round((s.hourly_rate_ore * minutes) / 60);
  if (s.pricing_mode === "service") minutes = s.min_minutes;
  return {
    estimated_minutes: minutes,
    estimated_price: s.pricing_mode === "consultation" ? "Price after consultation" : kr(price) ?? "Price after consultation",
    price_ore: price,
    deposit: kr(s.deposit_ore),
    size_tier: tier?.label ?? null,
  };
}

async function openSlots(studioId: string, s: Settings, fromDate?: string) {
  const sb = await admin();
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
  const start = from < new Date() ? new Date() : from;
  const to = new Date(Date.now() + s.horizon_days * 86400000);
  const { data } = await sb
    .from("studio_slots")
    .select("id, starts_at, duration_minutes")
    .eq("studio_id", studioId)
    .eq("status", "open")
    .gte("starts_at", start.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at")
    .limit(12);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (data ?? []).map((x) => ({ slot_id: x.id, label: fmt.format(new Date(x.starts_at)), starts_at: x.starts_at, minutes: x.duration_minutes }));
}

const TOOLS = [
  { type: "function", name: "get_quote", description: "Estimate price and time for a tattoo of a given size in cm.", parameters: { type: "object", properties: { size_cm: { type: "number" } } } },
  { type: "function", name: "find_slots", description: "List free times the studio has published. Optional from_date YYYY-MM-DD.", parameters: { type: "object", properties: { from_date: { type: "string" } } } },
  { type: "function", name: "book", description: "Book a free slot. Only call after the customer confirmed the summary (time, idea, size, placement, name, email, phone) and that they are 18+.", parameters: { type: "object", required: ["slot_id", "name", "email", "confirms_adult"], properties: { slot_id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string", description: "E.164, e.g. +46701234567" }, idea: { type: "string" }, motif_url: { type: "string" }, customer_language: { type: "string", enum: ["sv", "en"], description: "Language the customer writes in: sv for Swedish, en for anything else." }, placement: { type: "string" }, size_cm: { type: "number" }, confirms_adult: { type: "boolean" } } } },
];

async function book(ctx: { studio: StudioRow; s: Settings; threadId: string }, a: Record<string, unknown>) {
  if (a["confirms_adult"] !== true) return { error: "Customer must confirm they are 18 or older." };
  const email = String(a["email"] ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Invalid email." };
  const phone = a["phone"] ? String(a["phone"]).replace(/[\s-]/g, "") : null;
  const sb = await admin();
  const direct = ctx.s.booking_mode === "direct";
  const { data: slot } = await sb
    .from("studio_slots")
    .update({ status: direct ? "booked" : "held", booked_at: new Date().toISOString(), client_note: `Booking agent: ${String(a["name"]).slice(0, 80)}` })
    .eq("id", String(a["slot_id"]))
    .eq("studio_id", ctx.studio.user_id)
    .eq("status", "open")
    .select("id, starts_at, duration_minutes")
    .maybeSingle();
  if (!slot) return { error: "That time was just taken. Offer other times." };
  const size = typeof a["size_cm"] === "number" ? (a["size_cm"] as number) : null;
  const q = quote(ctx.s, size);
  const { data: row, error } = await sb
    .from("agent_bookings")
    .insert({
      studio_id: ctx.studio.user_id, thread_id: ctx.threadId, slot_id: slot.id, starts_at: slot.starts_at,
      duration_minutes: slot.duration_minutes, customer_name: String(a["name"]).slice(0, 120), customer_email: email,
      customer_phone: phone, idea: a["idea"] ? String(a["idea"]).slice(0, 1500) : null,
      motif_url: a["motif_url"] ? String(a["motif_url"]).slice(0, 500) : null,
      placement: a["placement"] ? String(a["placement"]).slice(0, 80) : null, size_cm: size,
      quoted_price_ore: q.price_ore, customer_lang: asLang(a["customer_language"], asLang(ctx.s.language)), status: direct ? "confirmed" : "pending",
    })
    .select("id")
    .single();
  if (error) { console.error("[agent] insert", error); return { error: "Could not save the booking." }; }
  await afterBooking(row.id, direct ? "confirmed" : "requested").catch((e) => console.error("[agent] notify", e));
  return { ok: true, status: direct ? "confirmed" : "waiting for studio approval", starts_at: slot.starts_at };
}

type Tpl = Partial<Record<"confirm_sv" | "confirm_en" | "reminder_sv" | "reminder_en", string>>;
/** Fill {namn} {datum} {tid} {studio} {adress} (also English {name} {date} {time} {address}). */
export function fillTemplate(text: string, v: { name: string; date: string; time: string; studio: string; address: string }) {
  return text
    .replace(/\{(namn|name)\}/g, v.name).replace(/\{(datum|date)\}/g, v.date).replace(/\{(tid|time)\}/g, v.time)
    .replace(/\{studio\}/g, v.studio).replace(/\{(adress|address)\}/g, v.address);
}

/** Customer message for an agent booking: studio's own text if set, else the standard one. */
export async function agentCustomerText(bookingId: string, kind: "confirm" | "reminder") {
  const sb = await admin();
  const { data: b } = await sb.from("agent_bookings").select("*").eq("id", bookingId).single();
  if (!b) return null;
  const { data: st } = await sb.from("artist_profiles").select("studio_name, address").eq("user_id", b.studio_id).single();
  const { data: cfg } = await sb.from("studio_agent_settings").select("language, message_templates").eq("studio_id", b.studio_id).maybeSingle();
  const lang = asLang(b.customer_lang, asLang(cfg?.language));
  const d = new Date(b.starts_at);
  const loc = lang === "sv" ? "sv-SE" : "en-GB";
  const v = {
    name: b.customer_name, studio: st?.studio_name ?? "Studio", address: st?.address ?? "",
    date: new Intl.DateTimeFormat(loc, { timeZone: TZ, dateStyle: "medium" }).format(d),
    time: new Intl.DateTimeFormat(loc, { timeZone: TZ, timeStyle: "short" }).format(d),
  };
  const own = ((cfg?.message_templates ?? {}) as Tpl)[`${kind}_${lang}`]?.trim();
  const std = kind === "confirm"
    ? (lang === "sv" ? "Bokat hos {studio}: {datum} kl. {tid}{adr}. Kalenderinbjudan skickas till din e-post." : "Booked at {studio}: {datum} at {tid}{adr}. A calendar invite is on its way to your email.")
    : (lang === "sv" ? "Påminnelse: du har en tid hos {studio} {datum} kl. {tid}{adr}." : "Reminder: you have an appointment at {studio} on {datum} at {tid}{adr}.");
  const text = own ? fillTemplate(own, v) : fillTemplate(std.replace("{adr}", v.address ? `, ${v.address}` : ""), v);
  const heading = kind === "confirm" ? (lang === "sv" ? `Din tid hos ${v.studio} är bokad` : `Your appointment at ${v.studio} is booked`) : (lang === "sv" ? `Påminnelse från ${v.studio}` : `Reminder from ${v.studio}`);
  return { b, text, heading, lang, studio: v.studio };
}

async function emailCustomer(bookingId: string, kind: "confirm" | "reminder") {
  const m = await agentCustomerText(bookingId, kind);
  if (!m) return null;
  if (m.b.customer_email) {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("studio-booking-message", m.b.customer_email, {
      templateData: { studioName: m.studio, heading: m.heading, message: m.text, lang: m.lang },
      idempotencyKey: `agent-${kind}-${bookingId}`,
    }).catch((e) => console.error("[agent] email", e));
  }
  return m;
}
export { emailCustomer as sendAgentCustomerMessage };

/** Calendar invite + SMS + in-app notice. `requested` only notifies the studio. */
export async function afterBooking(bookingId: string, phase: "confirmed" | "requested" | "declined") {
  const sb = await admin();
  const { data: b } = await sb.from("agent_bookings").select("*").eq("id", bookingId).single();
  if (!b) return;
  const { data: st } = await sb.from("artist_profiles").select("studio_name, address, notify_phone, notify_sms_enabled").eq("user_id", b.studio_id).single();
  const { data: cfg } = await sb.from("studio_agent_settings").select("language").eq("studio_id", b.studio_id).maybeSingle();
  const studioLang = asLang(cfg?.language); // studio notices: studio's base language
  const custLang = asLang(b.customer_lang, studioLang); // customer texts: customer's language
  const fmtWhen = (l: Lang) => new Intl.DateTimeFormat(l === "sv" ? "sv-SE" : "en-GB", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(b.starts_at));
  const when = fmtWhen(studioLang);
  const cWhen = fmtWhen(custLang);
  const name = st?.studio_name ?? "Studio";
  const { notifyInApp } = await import("./notify.server");
  const bookingLink = studioBookingUrl(b.id, true);
  if (phase === "declined") {
    if (b.customer_phone) await sendSms(b.customer_phone, custLang === "sv" ? `${name}: tyvärr kan vi inte ta tiden ${cWhen}. Boka en ny tid via InkSimulator.` : `${name}: unfortunately we can't take the ${cWhen} slot. Please book a new time via InkSimulator.`);
    return;
  }
  await notifyInApp(b.studio_id, { kind: "booking", body: studioLang === "sv" ? `${phase === "requested" ? "Ny bokningsförfrågan" : "Ny bokning"} via bokningsagenten: ${b.customer_name}, ${when}` : `${phase === "requested" ? "New booking request" : "New booking"} via booking agent: ${b.customer_name}, ${when}`, link: studioBookingPath(b.id, true) });
  if (st?.notify_sms_enabled && st.notify_phone) {
    await sendSms(st.notify_phone, (studioLang === "sv" ? `InkSimulator: ${phase === "requested" ? "Ny förfrågan" : "Ny bokning"} från bokningsagenten — ${b.customer_name}, ${when}.` : `InkSimulator: ${phase === "requested" ? "New request" : "New booking"} from the booking agent — ${b.customer_name}, ${when}.`) + ` ${bookingLink}`);
  }
  if (phase === "requested" || (phase === "confirmed" && b.status === "confirmed")) {
    const { primaryEmail } = await import("./notify.server");
    const recipient = await primaryEmail(b.studio_id);
    if (recipient) {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("booking-request", recipient, { templateData: {
        studioName: name, clientName: b.customer_name, date: when, bodyArea: b.placement ?? undefined,
        sizeCm: b.size_cm != null ? String(b.size_cm) : undefined, note: b.idea ?? undefined, link: bookingLink,
      }, idempotencyKey: `agent-studio-${b.id}-${recipient}` }).catch((e) => console.error("[agent] studio email", e));
    }
  }
  if (phase === "confirmed") {
    const msg = await emailCustomer(b.id, "confirm");
    if (b.customer_phone && msg) await sendSms(b.customer_phone, msg.text);
    const { getStudioCalendarKey } = await import("./studioCalendar.server");
    const link = await getStudioCalendarKey(b.studio_id);
    if (link) {
      const end = new Date(new Date(b.starts_at).getTime() + b.duration_minutes * 60000);
      await fetch(`https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/${encodeURIComponent(link.calendarId)}/events?sendUpdates=all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "X-Connection-Api-Key": link.key, "Content-Type": "application/json" },
        body: JSON.stringify({
          // Invite goes to the customer, so it follows the customer's language.
          summary: custLang === "sv" ? `Tatuering hos ${name} — ${b.customer_name}` : `Tattoo at ${name} — ${b.customer_name}`,
          description: [b.idea, b.placement && `${custLang === "sv" ? "Placering" : "Placement"}: ${b.placement}`, b.size_cm && `${custLang === "sv" ? "Storlek" : "Size"}: ${b.size_cm} cm`, b.motif_url, custLang === "sv" ? "Bokad via InkSimulators bokningsagent" : "Booked via InkSimulator booking agent"].filter(Boolean).join("\n"),
          location: st?.address ?? undefined,
          start: { dateTime: new Date(b.starts_at).toISOString() },
          end: { dateTime: end.toISOString() },
          attendees: [{ email: b.customer_email }],
          extendedProperties: { private: { inkvisionBookingId: b.id } },
        }),
      }).catch((e) => console.error("[agent] calendar", e));
    }
  }
}

export async function runAgent(handle: string, sessionKey: string, userText: string) {
  const loaded = await loadAgentStudio(handle);
  if (!loaded || !loaded.settings?.enabled) return { error: "not_active" as const };
  const { studio, settings: s } = loaded;
  const sb = await admin();
  let { data: thread } = await sb.from("agent_threads").select("id, messages").eq("studio_id", studio.user_id).eq("session_key", sessionKey).maybeSingle();
  if (!thread) {
    const ins = await sb.from("agent_threads").insert({ studio_id: studio.user_id, session_key: sessionKey }).select("id, messages").single();
    thread = ins.data;
  }
  if (!thread) return { error: "failed" as const };
  const history = (thread.messages as unknown as { role: "user" | "assistant"; content: string }[]) ?? [];
  if (history.length > 80) return { error: "limit" as const };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const system = `You are the booking assistant for the tattoo studio "${studio.studio_name}"${studio.address ? ` at ${studio.address}` : ""}${studio.city ? `, ${studio.city}` : ""}. Today is ${today} (${TZ}). The studio's default language is ${s.language === "en" ? "English" : "Swedish"}: use it for greetings until the customer writes. Always detect the language the customer writes in and reply in that language (Swedish or English), short and friendly. When booking, set customer_language to "sv" if the customer writes Swedish, otherwise "en".
Help the customer describe their tattoo idea, placement and size (cm), give an estimate with get_quote, offer free times with find_slots (never invent times), and book with book.
Before booking, summarise time, idea, placement, size, name, email and phone, and ask the customer to confirm and to confirm they are 18+.
Booking mode: ${s.booking_mode === "direct" ? "bookings are confirmed immediately" : "the studio approves each request before it is confirmed"}.
Pricing mode: ${s.pricing_mode}. ${s.deposit_ore ? `Deposit: ${kr(s.deposit_ore)}.` : ""}
Opening hours: ${studio.opening_hours ?? "see free times"}.
Studio info: ${s.knowledge || studio.bio || ""}`;
  const input: InputItem[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userText },
  ];
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { error: "failed" as const };
  let reply = "";
  for (let i = 0; i < 6; i++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: MODEL, instructions: system, input, tools: TOOLS, reasoning: { effort: "low" } }),
    });
    if (!res.ok) { console.error("[agent] ai", res.status, await res.text().catch(() => "")); return { error: res.status === 429 ? "busy" as const : "failed" as const }; }
    const json = (await res.json()) as { output?: Array<{ type: string; call_id?: string; name?: string; arguments?: string; content?: Array<{ type: string; text?: string }> }> };
    const output = json.output ?? [];
    const calls = output.filter((o) => o.type === "function_call");
    if (!calls.length) {
      reply = output.filter((o) => o.type === "message").flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("").trim();
      break;
    }
    for (const call of calls) {
      input.push({ type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments ?? "{}" });
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.arguments || "{}"); } catch { /* ignore */ }
      let out: unknown;
      if (call.name === "get_quote") out = quote(s, typeof args["size_cm"] === "number" ? (args["size_cm"] as number) : null);
      else if (call.name === "find_slots") out = await openSlots(studio.user_id, s, typeof args["from_date"] === "string" ? (args["from_date"] as string) : undefined);
      else if (call.name === "book") out = await book({ studio, s, threadId: thread.id }, args);
      else out = { error: "unknown tool" };
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(out) });
    }
  }
  if (!reply) reply = "Sorry, something went wrong. Please try again.";
  const next = [...history, { role: "user", content: userText }, { role: "assistant", content: reply }];
  await sb.from("agent_threads").update({ messages: next, updated_at: new Date().toISOString() }).eq("id", thread.id);
  return { reply };
}
