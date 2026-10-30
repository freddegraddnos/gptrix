import { useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { setSubscribed } from "@/lib/access";

export type SubscriptionRow = {
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

function isPaid(row: SubscriptionRow | null): boolean {
  if (!row) return false;
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  const inWindow = !end || end.getTime() > Date.now();
  if (["active", "trialing", "past_due"].includes(row.status) && inWindow) return true;
  if (row.status === "canceled" && inWindow) return true;
  return false;
}

/**
 * Syncs the user's active subscription row (Stripe) + any referral bonus
 * window from `profiles.bonus_until` into the local `subscribed` flag.
 */
export function useSubscription(userId: string | undefined) {
  const [row, setRow] = useState<SubscriptionRow | null>(null);
  const [bonusUntil, setBonusUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Unique per hook instance: several components subscribe at once and
  // sharing a channel topic makes supabase-js throw on the second listener.
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");


  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId) {
        setRow(null);
        setBonusUntil(null);
        setSubscribed(false);
        setLoading(false);
        return;
      }
      const env = (() => {
        try {
          return getStripeEnvironment();
        } catch {
          return "sandbox" as const;
        }
      })();
      const [subQ, profQ] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("status, price_id, current_period_end, cancel_at_period_end")
          .eq("user_id", userId)
          .eq("environment", env)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("profiles").select("bonus_until").eq("id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      const subRow = (subQ.data as SubscriptionRow | null) ?? null;
      const bu = (profQ.data as { bonus_until: string | null } | null)?.bonus_until ?? null;
      setRow(subRow);
      setBonusUntil(bu);
      const paid = isPaid(subRow);
      const bonusActive = !!bu && new Date(bu).getTime() > Date.now();
      setSubscribed(paid || bonusActive);
      setLoading(false);
    };
    void run();

    if (!userId) return;
    const channel = supabase
      .channel(`sub-bonus-${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => void run(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => void run(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  const bonusActive = !!bonusUntil && new Date(bonusUntil).getTime() > Date.now();
  return {
    row,
    bonusUntil,
    bonusActive,
    isActive: isPaid(row) || bonusActive,
    loading,
  };
}

