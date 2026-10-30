import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const PENDING_REFERRAL_KEY = "inkvision.referral.pending";
const REDEEMED_KEY = "inkvision.referral.redeemed";

/** Persist a code the user landed with via /i/{code}. */
export function stashPendingReferral(code: string) {
  if (typeof window === "undefined") return;
  const norm = code.trim().toUpperCase();
  if (!norm) return;
  window.localStorage.setItem(PENDING_REFERRAL_KEY, norm);
}

export function readPendingReferral(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_REFERRAL_KEY);
}

export function clearPendingReferral() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_REFERRAL_KEY);
}

type RedeemResult = { ok: boolean; error?: string; granted_days?: number };

/**
 * Auto-redeems any pending /i/{code} referral as soon as a user is signed in.
 * Idempotent — remembers the last-redeemed userId to avoid re-calls.
 */
export function useRedeemPendingReferral() {
  const { user } = useAuth();
  const [result, setResult] = useState<RedeemResult | null>(null);

  useEffect(() => {
    if (!user) return;
    const code = readPendingReferral();
    if (!code) return;
    const alreadyKey = `${REDEEMED_KEY}:${user.id}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(alreadyKey)) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("redeem_referral", { _code: code });
      if (cancelled) return;
      const r = (data ?? { ok: false, error: error?.message ?? "unknown" }) as RedeemResult;
      setResult(r);
      if (r.ok || r.error === "already_redeemed" || r.error === "self_referral") {
        window.localStorage.setItem(alreadyKey, "1");
        clearPendingReferral();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return result;
}

/** Fetch/create the current user's own referral code. */
export function useMyReferralCode() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [uses, setUses] = useState<number>(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("ensure_referral_code");
    if (data) setCode(String(data).toUpperCase());
    // Count redemptions of this user's code
    const { count } = await supabase
      .from("referral_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", user.id);
    setUses(count ?? 0);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { code, uses, refresh };
}
