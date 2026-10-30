// Small helpers for "remember me" behaviour.
//
// Supabase always persists the session in localStorage. When the user opts out
// of "remember me" we clear that session the next time a *new* browser session
// starts (tracked with sessionStorage, which dies with the tab/window).

const REMEMBER_KEY = "inkvision.remember-me";
const TAB_KEY = "inkvision.session-alive";

export function setRememberMe(value: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, value ? "1" : "0");
    sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    /* storage blocked */
  }
}

export function getRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
}

/** True when this is a fresh browser session (tab opened after a full close). */
export function isNewBrowserSession(): boolean {
  try {
    return sessionStorage.getItem(TAB_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markBrowserSessionAlive() {
  try {
    sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    /* storage blocked */
  }
}
