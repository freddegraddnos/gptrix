import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { safeRedirect } from "./authRedirect";

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/),
  password: z.string().min(8).max(72),
  email: z.string().email().max(255).refine((email) => !email.toLowerCase().endsWith("@users.inksimulator.com")),
  phone: z.string().trim().max(30).regex(/^[+()\d\s.-]*$/).optional(),
  adult: z.boolean(),
  redirectOrigin: z.string().url(),
  redirectPath: z.string().max(2048).optional(),
});

/** Creates an account with a real, deliverable email; confirmation is required. */
export const signUpWithUsername = createServerFn({ method: "POST" })
  .validator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("handle", data.username)
      .maybeSingle();
    if (taken) return { ok: false as const, error: "That username is taken." };

    const origin = new URL(data.redirectOrigin);
    if (origin.origin !== data.redirectOrigin || !(
      origin.hostname === "localhost" ||
      origin.hostname === "inksimulator.com" ||
      origin.hostname.endsWith(".inksimulator.com") ||
      origin.hostname.endsWith(".lovable.app")
    )) return { ok: false as const, error: "Invalid confirmation address." };
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Sign-up is temporarily unavailable.");
    const client = createClient(url, key, {
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const returnPath = safeRedirect(data.redirectPath);
    const emailRedirectTo = `${origin.origin}/auth${returnPath ? `?redirect=${encodeURIComponent(returnPath)}` : ""}`;
    const { data: created, error } = await client.auth.signUp({
      email: data.email.toLowerCase(),
      password: data.password,
      options: { emailRedirectTo, data: { display_name: data.username, username: data.username } },
    });
    if (error || !created.user || created.user.identities?.length === 0) {
      console.error("[signUpWithUsername]", error?.message);
      const msg = /already/i.test(error?.message ?? "")
        ? "That username or email is already in use."
        : /weak|guess|pwned|password/i.test(error?.message ?? "")
          ? "That password is too common — choose a different one."
          : "Could not create the account.";
      return { ok: false as const, error: msg };
    }
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, handle: data.username, username_set: true, display_name: data.username, contact_email: data.email.toLowerCase(), phone: data.phone || null, adult_declared_at: data.adult ? new Date().toISOString() : null } as never);
    if (profileError) {
      return { ok: false as const, error: "Could not save the account. Please try again." };
    }
    return { ok: true as const };
  });

/** Resolve the handle on the server; never disclose another user's email to the browser. */
export const signInWithUsername = createServerFn({ method: "POST" })
  .validator((d) => schema.pick({ username: true, password: true }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").ilike("handle", data.username).maybeSingle();
    if (!profile) return { ok: false as const, error: "Wrong username or password." };
    const { data: account, error: accountError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (accountError || !account.user?.email) return { ok: false as const, error: "Wrong username or password." };
    const email = account.user.email;
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Sign-in is temporarily unavailable.");
    const client = createClient(url, key, {
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !signed.session) return { ok: false as const, error: "Wrong username or password." };
    return { ok: true as const, accessToken: signed.session.access_token, refreshToken: signed.session.refresh_token };
  });
