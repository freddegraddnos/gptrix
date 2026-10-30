import { useEffect, useState } from "react";

/**
 * False during server rendering and the first client render, true afterwards.
 * Use it to gate anything that depends on browser-only state (auth session,
 * localStorage) so the first client render matches the server HTML.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
