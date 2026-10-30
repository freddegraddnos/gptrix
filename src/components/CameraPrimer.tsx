import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { Camera, ShieldCheck } from "lucide-react";
import { track } from "@/lib/track";

import { tx, useUiLang } from "@/lib/uiLang";
type State = "checking" | "prompt" | "denied" | "granted";

/**
 * Explains the camera before the browser asks for it. Renders children only
 * after the visitor chose to turn the camera on (or already allowed it).
 */
export function CameraPrimer({ children }: { children: ReactNode }) {
  useUiLang();
  const routeSearch = useSearch({ strict: false }) as { motif?: unknown };
  const motif = typeof routeSearch.motif === "string" ? routeSearch.motif : undefined;
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    const perms = navigator.permissions as Permissions | undefined;
    if (!perms?.query) {
      setState("prompt");
      return;
    }
    perms
      .query({ name: "camera" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        setState(s.state === "granted" ? "granted" : s.state === "denied" ? "denied" : "prompt");
      })
      .catch(() => !cancelled && setState("prompt"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === "prompt") track("camera_prompt_shown");
    if (state === "denied") track("camera_denied");
    if (state === "granted") {
      track("ar_started");
      track("tryon_started", { mode: "live_ar" });
    }
  }, [state]);

  const turnOn = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      track("camera_granted");
      setState("granted");
    } catch {
      setState("denied");
    }
  };

  if (state === "granted") return <>{children}</>;
  if (state === "checking") return <div className="min-h-dvh bg-background" />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-7 text-center text-foreground">
      <span className="flex size-16 items-center justify-center rounded-2xl border border-accent/40 bg-accent/10 text-accent">
        <Camera className="size-7" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="max-w-sm">
        <h1 className="font-display text-3xl uppercase leading-none">{tx("See it on your skin")}</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          {tx("Live AR needs your camera to place the tattoo at true size.")}
        </p>
        <p className="mt-4 inline-flex items-start gap-2 text-left text-[12px] leading-relaxed text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          {tx("Your camera stays on your device. Nothing is recorded or uploaded unless you choose to save or share.")}
        </p>
      </div>

      {state === "denied" ? (
        <div className="max-w-sm rounded-2xl border border-border bg-card p-4 text-left text-[12px] leading-relaxed">
          <p className="font-bold">{tx("Camera is blocked for this site.")}</p>
          <p className="mt-2 text-muted-foreground">
            {tx("iPhone: Settings → Safari → Camera → Allow, or tap “aA” in the address bar → Website Settings.")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {tx("Android: tap the lock icon next to the address → Permissions → Camera → Allow.")}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-accent bg-accent px-4 font-display text-lg uppercase text-accent-foreground"
          >
            {tx("I allowed it — reload")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void turnOn()}
          className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-sm border border-accent bg-accent px-4 font-display text-lg uppercase text-accent-foreground transition-colors hover:bg-accent/85"
        >
          <Camera className="size-5" aria-hidden />{" "}{tx("Turn on camera")}
        </button>
      )}

      <Link to="/photo-tryon" search={{ motif }} className="text-[12px] text-muted-foreground underline underline-offset-4">
        {tx("Use a photo instead")}
      </Link>
    </div>
  );
}
