import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getRememberMe,
  isNewBrowserSession,
  markBrowserSessionAlive,
} from "@/lib/authSession";

type AuthState = { session: Session | null; user: User | null; loading: boolean };

let state: AuthState = { session: null, user: null, loading: true };
const listeners = new Set<(s: AuthState) => void>();
let started = false;
/** Set when we sign the user out on purpose, so we don't warn about expiry. */
let intentionalSignOut = false;

function publish(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

/** Call right before supabase.auth.signOut() to get the friendly message. */
export function markIntentionalSignOut() {
  intentionalSignOut = true;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  supabase.auth.onAuthStateChange((event, s) => {
    const hadSession = state.session !== null;
    publish({ session: s, user: s?.user ?? null, loading: false });

    if (event === "SIGNED_OUT" && hadSession) {
      if (intentionalSignOut) {
        toast.success("You're signed out. See you soon.");
      } else {
        toast.warning("Your session expired — please sign in again.");
      }
      intentionalSignOut = false;
    }
  });

  void (async () => {
    const { data } = await supabase.auth.getSession();

    // "Remember me" opt-out: drop the session when the browser was closed.
    if (data.session && !getRememberMe() && isNewBrowserSession()) {
      markBrowserSessionAlive();
      intentionalSignOut = true;
      await supabase.auth.signOut();
      toast.info("Signed out because “Remember me” was off.");
      publish({ session: null, user: null, loading: false });
      return;
    }

    markBrowserSessionAlive();
    publish({
      session: data.session,
      user: data.session?.user ?? null,
      loading: false,
    });
  })();
}

export function useAuth() {
  const [local, setLocal] = useState<AuthState>(state);

  useEffect(() => {
    start();
    listeners.add(setLocal);
    setLocal(state);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  return local;
}
