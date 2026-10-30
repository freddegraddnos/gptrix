/**
 * Commerce visibility.
 *
 * The marketplace is still on the Stripe test environment (card 4242), so no
 * kronor are shown anywhere in the app and the Shop tab stays hidden. Flip
 * VITE_MARKETPLACE_LIVE to "true" once live Stripe keys are provisioned.
 */
export const MARKETPLACE_LIVE =
  import.meta.env.VITE_MARKETPLACE_LIVE === "true";

/** Trying any design in AR is always free, live or not. */
export const AR_IS_FREE = true;

export function formatKr(ore: number): string {
  return `${Math.round(ore / 100)} kr`;
}
