import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function env(names: readonly string[]): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  for (const n of names) {
    const v = runtime.process?.env?.[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

function url(): string {
  const u = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!u) throw new Error("SUPABASE_URL is required");
  return u;
}

function key(): string {
  const direct = env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = env(["SUPABASE_PUBLISHABLE_KEYS"]);
  if (keyset) {
    try {
      const parsed = JSON.parse(keyset) as Record<string, unknown>;
      const k = [parsed.default, ...Object.values(parsed)].find(
        (v): v is string => typeof v === "string" && v.startsWith("sb_publishable_"),
      );
      if (k) return k;
    } catch {
      // fall through
    }
  }
  const legacy = env(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("Supabase publishable key is required");
}

export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(url(), key(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
