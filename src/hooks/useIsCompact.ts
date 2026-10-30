import { useEffect, useState } from "react";

/** Phone-width breakpoint: below this the UI switches to bottom sheets. */
export const COMPACT_MAX_WIDTH = 767;

/**
 * True on narrow screens (phones). Read after hydration only, so server and
 * client render the same markup on the first pass.
 */
export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH}px)`);
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return compact;
}
