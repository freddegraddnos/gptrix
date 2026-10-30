import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const studioInput = z.object({ studioId: z.string().uuid() });

export const getAgentPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => studioInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [settings, bookings, threads, profile] = await Promise.all([
      sb.from("studio_agent_settings").select("*").eq("studio_id", data.studioId).maybeSingle(),
      sb.from("agent_bookings").select("*").eq("studio_id", data.studioId).order("starts_at", { ascending: false }).limit(50),
      sb.from("agent_threads").select("id, messages, updated_at").eq("studio_id", data.studioId).order("updated_at", { ascending: false }).limit(30),
      sb.from("artist_profiles").select("handle, studio_name").eq("user_id", data.studioId).maybeSingle(),
    ]);
    return {
      settings: settings.data,
      bookings: bookings.data ?? [],
      threads: (threads.data ?? []).map((t) => ({ id: t.id, updated_at: t.updated_at, messages: t.messages as unknown as { role: string; content: string }[] })),
      handle: profile.data?.handle ?? null,
      studioName: profile.data?.studio_name ?? null,
    };
  });

const tier = z.object({ label: z.string().max(12), max_cm: z.number().min(1).max(200), price_ore: z.number().int().min(0), minutes: z.number().int().min(15).max(1440) });

export const saveAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      studioId: z.string().uuid(),
      enabled: z.boolean(),
      booking_mode: z.enum(["direct", "approve"]),
      pricing_mode: z.enum(["hourly", "size", "service", "consultation"]),
      hourly_rate_ore: z.number().int().min(0).nullable(),
      size_tiers: z.array(tier).max(8),
      min_minutes: z.number().int().min(15).max(1440),
      buffer_minutes: z.number().int().min(0).max(240),
      horizon_days: z.number().int().min(1).max(365),
      deposit_ore: z.number().int().min(0).nullable(),
      knowledge: z.string().max(4000),
      language: z.enum(["sv", "en"]).default("sv"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { studioId, ...rest } = data;
    const { error } = await context.supabase
      .from("studio_agent_settings")
      .upsert({ studio_id: studioId, ...rest, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideAgentBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookingId: z.string().uuid(), decision: z.enum(["confirm", "decline"]) }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: only studio staff can see the row.
    const { data: b } = await context.supabase.from("agent_bookings").select("id, studio_id, slot_id, status").eq("id", data.bookingId).maybeSingle();
    if (!b) throw new Error("Booking not found");
    const { data: isAdmin } = await context.supabase.rpc("is_studio_admin", { _studio: b.studio_id, _user: context.userId });
    if (!isAdmin && b.studio_id !== context.userId) throw new Error("Forbidden");
    if (b.status !== "pending") throw new Error("Already handled");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const confirm = data.decision === "confirm";
    if (b.slot_id) {
      await supabaseAdmin.from("studio_slots").update(confirm ? { status: "booked", approved_at: new Date().toISOString() } : { status: "open", booked_at: null, client_note: null }).eq("id", b.slot_id);
    }
    await supabaseAdmin.from("agent_bookings").update({ status: confirm ? "confirmed" : "declined", updated_at: new Date().toISOString() }).eq("id", b.id);
    const { afterBooking } = await import("@/lib/agent.server");
    await afterBooking(b.id, confirm ? "confirmed" : "declined").catch((e) => console.error("[agent] decide notify", e));
    return { ok: true };
  });

/** Private agent booking details for the studio booking link. */
export const getAgentBookingDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase.from("agent_bookings").select("id, studio_id, customer_name, customer_email, customer_phone, starts_at, duration_minutes, placement, size_cm, idea, motif_url, status").eq("id", data.bookingId).maybeSingle();
    if (!booking) throw new Error("Booking not found");
    const { data: isAdmin } = await context.supabase.rpc("is_studio_admin", { _studio: booking.studio_id, _user: context.userId });
    if (!isAdmin && booking.studio_id !== context.userId) throw new Error("Booking not found");
    return booking;
  });

/** Site paths a studio address may not take (inksimulator.com/<handle>). */
const RESERVED = new Set(["README", "about", "admin", "adminsignup", "advisor", "agent", "api", "ar", "artist", "artists", "assets", "auth", "before-after", "boka", "bookings", "brand", "calibrate", "checkout", "community", "compare", "couples", "create", "discover", "for-studios", "friends", "generator", "guides", "help", "history", "i", "index", "install", "invite", "library", "live-tryon", "llms", "login", "lovable", "m", "mcp", "messages", "mode3d", "my-designs", "notifications", "oauth", "onboarding", "p", "photo-tryon", "pricing", "privacy", "profile", "projects", "requests", "reset-password", "reveal", "rita", "robots", "s", "scan-my-body", "scans", "seo-health", "settings", "shop", "signup", "sitemap", "sleeve-builder", "snapchat", "start", "static", "studio", "studios", "support", "tattoo-font-generator", "terms", "try-it-on", "u", "v", "vote-results", "votes", "websummit", "www"]);

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

/** Change a studio's public address (inksimulator.com/handle, /handle/book, /handle/agent). Old address keeps forwarding. */
export const changeStudioHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studioId: z.string().uuid(), handle: z.string().trim().toLowerCase() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!HANDLE_RE.test(data.handle)) throw new Error("Use 3–30 lowercase letters, numbers or hyphens.");
    if (RESERVED.has(data.handle)) throw new Error("That address is reserved. Pick another.");
    const { data: isAdmin } = await context.supabase.rpc("is_studio_admin", { _studio: data.studioId, _user: context.userId });
    if (!isAdmin && data.studioId !== context.userId) throw new Error("Forbidden");
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: me } = await sb.from("artist_profiles").select("handle").eq("user_id", data.studioId).maybeSingle();
    if (!me) throw new Error("Studio profile not found");
    if ((me.handle ?? "").toLowerCase() === data.handle) return { handle: data.handle };
    const [a, p, h] = await Promise.all([
      sb.from("artist_profiles").select("user_id").ilike("handle", data.handle).neq("user_id", data.studioId).limit(1),
      sb.from("profiles").select("id").ilike("handle", data.handle).neq("id", data.studioId).limit(1),
      sb.from("studio_handle_history").select("user_id").eq("old_handle", data.handle).neq("user_id", data.studioId).limit(1),
    ]);
    if (a.data?.length || p.data?.length || h.data?.length) throw new Error("That address is taken. Try another.");
    const { error } = await sb.from("artist_profiles").update({ handle: data.handle }).eq("user_id", data.studioId);
    if (error) throw new Error(error.message);
    await sb.from("studio_handle_history").delete().eq("old_handle", data.handle);
    if (me.handle) await sb.from("studio_handle_history").upsert({ old_handle: me.handle.toLowerCase(), user_id: data.studioId });
    return { handle: data.handle };
  });

const tpl = z.string().max(600).default("");
/** Studio's own booking texts. Empty = default text. Placeholders: {namn} {datum} {tid} {studio} {adress}. */
export const saveMessageTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    studioId: z.string().uuid(),
    templates: z.object({ confirm_sv: tpl, confirm_en: tpl, reminder_sv: tpl, reminder_en: tpl }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase.from("studio_agent_settings").select("studio_id").eq("studio_id", data.studioId).maybeSingle();
    const q = existing
      ? context.supabase.from("studio_agent_settings").update({ message_templates: data.templates, updated_at: new Date().toISOString() }).eq("studio_id", data.studioId)
      : context.supabase.from("studio_agent_settings").insert({ studio_id: data.studioId, message_templates: data.templates });
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
