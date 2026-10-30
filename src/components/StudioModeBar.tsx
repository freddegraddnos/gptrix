import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useStudioAccount } from "@/hooks/useStudioAccount";
import { tx, useUiLang } from "@/lib/uiLang";

/** Camera pages keep the full screen for the AR view. */
const HIDDEN = [/^\/ar(v2)?(\/|$)/, /^\/live-tryon/, /^\/mode3d/];

function contextLabel(pathname: string, handle: string | null): string {
  if (/^\/(sv\/)?artists(\/|$)/.test(pathname) && !/^\/artists\/(browse|search)/.test(pathname)) return tx("Panel");
  const own = handle ? handle.toLowerCase() : null;
  const first = pathname.split("/")[1]?.toLowerCase() ?? "";
  if (own && (first === own || pathname.toLowerCase() === `/boka/${own}`)) return tx("Your published page");
  return tx("Customer pages");
}

/** Steady marker shown on every page while a studio account is signed in. */
export function StudioModeBar({ pathname }: { pathname: string }) {
  useUiLang();
  const { isStudio, studioName, handle } = useStudioAccount();
  const ref = useRef<HTMLDivElement>(null);
  const visible = isStudio && !HIDDEN.some((r) => r.test(pathname));
  // Shared height model: full-height pages (e.g. drawing studio) subtract this bar.
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!visible || !el) { root.style.setProperty("--studio-bar-h", "0px"); return; }
    const set = () => root.style.setProperty("--studio-bar-h", `${el.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => { ro.disconnect(); root.style.setProperty("--studio-bar-h", "0px"); };
  }, [visible]);
  if (!isStudio || HIDDEN.some((r) => r.test(pathname))) return null;
  return (
    <div ref={ref} role="status" aria-label={tx("Studio mode")} className="sticky top-0 z-[60] border-b border-accent/40 bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-8 max-w-7xl items-center gap-2 px-4 font-mono text-[11px] leading-tight text-foreground sm:px-5">
        <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
        <span className="min-w-0 truncate">
          {tx("Studio mode")} · <span className="font-medium">{studioName}</span>
        </span>
        <span className="shrink-0 text-muted-foreground">· {contextLabel(pathname, handle)}</span>
        {!/^\/(sv\/)?artists(\/|$)/.test(pathname) && (
          <Link to="/artists/dashboard" className="ml-auto shrink-0 underline underline-offset-2 hover:text-accent">
            {tx("To the panel")}
          </Link>
        )}
      </div>
    </div>
  );
}
