import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Shows the username picker ONCE, right after the first login.
 * Public/shared pages are left untouched so links work without an account.
 */
const SKIP_PREFIXES = [
  "/onboarding",
  "/auth",
  "/v/",
  "/p/",
  "/s/",
  "/i/",
  "/u/",
  "/@",
  "/invite/",
  "/api/",
  "/artists",
  "/sv/artists",
];

export function UsernameGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
    if (checkedFor.current === user.id) return;
    checkedFor.current = user.id;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("handle, username_set")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      if (!data.username_set && !data.handle) {
        navigate({ to: "/onboarding/username" });
      }
      // The guided tutorial is no longer forced on new accounts — the start
      // menu is the first thing they see instead.
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, pathname, navigate]);

  return null;
}
