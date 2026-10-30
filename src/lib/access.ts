import { useEffect, useSyncExternalStore } from "react";

export const DEFAULT_PX_PER_CM = 16;

type State = {
  subscribed: boolean;
  /** Pixels-per-centimeter derived from coin calibration. */
  pxPerCm: number;
  /** 50% referral/promo-code applied. */
  discountApplied: boolean;
};

const STORAGE_KEY = "tattooar.access.v2";
const listeners = new Set<() => void>();
// App is free — access is always granted.
let state: State = {
  subscribed: true,
  pxPerCm: DEFAULT_PX_PER_CM,
  discountApplied: false,
};

function read(): State {
  if (typeof window === "undefined") return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return state;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      subscribed: true,
      pxPerCm:
        typeof parsed.pxPerCm === "number" && parsed.pxPerCm > 0
          ? parsed.pxPerCm
          : DEFAULT_PX_PER_CM,
      discountApplied: !!parsed.discountApplied,
    };
  } catch {
    return state;
  }
}

function persist(next: State) {
  state = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useAccess() {
  const value = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  useEffect(() => {
    const fresh = read();
    if (
      fresh.subscribed !== state.subscribed ||
      fresh.pxPerCm !== state.pxPerCm ||
      fresh.discountApplied !== state.discountApplied
    ) {
      persist(fresh);
    }
  }, []);
  return value;
}

export function setSubscribed(_subscribed?: boolean) {
  persist({ ...read(), subscribed: true });
}

export function setPxPerCm(pxPerCm: number) {
  persist({ ...read(), pxPerCm });
}

export function setDiscountApplied(discountApplied: boolean) {
  persist({ ...read(), discountApplied });
}

/** Returns validation result for a discount / referral code. */
export function validatePromoCode(raw: string): {
  ok: boolean;
  reason?: string;
  freeAccess?: boolean;
} {
  const c = raw.trim().toUpperCase();
  if (!c) return { ok: false, reason: "Empty code" };
  if (c === "EARLYBIRD") return { ok: true, freeAccess: true };
  const VALID = new Set(["INK50", "WELCOME", "TATTOO50", "REFERRAL", "BUDDY50"]);
  if (VALID.has(c)) return { ok: true };
  // Also accept 8-char referral codes (alphanumeric, from profiles.referral_code)
  if (/^[a-z0-9]{8}$/i.test(c)) return { ok: true };
  return { ok: false, reason: "Invalid code" };
}

export const COINS = [
  { id: "sek-5", label: "Swedish 5 kr", country: "🇸🇪", diameterMm: 23.75 },
  { id: "sek-10", label: "Swedish 10 kr", country: "🇸🇪", diameterMm: 20.5 },
  { id: "usd-quarter", label: "US Quarter", country: "🇺🇸", diameterMm: 24.26 },
  { id: "eur-1", label: "1 Euro", country: "🇪🇺", diameterMm: 23.25 },
  { id: "gbp-1", label: "1 Pound", country: "🇬🇧", diameterMm: 23.43 },
  { id: "cad-1", label: "1 Loonie", country: "🇨🇦", diameterMm: 26.5 },
  {
    id: "card",
    label: "Bank card",
    country: "💳",
    // ID-1: 85.60 x 53.98 mm — matched as a rectangle instead of a circle.
    diameterMm: 85.6,
    shape: "card",
    heightMm: 53.98,
  },
] as const;
