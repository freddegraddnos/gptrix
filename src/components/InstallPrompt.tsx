import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import {
  canOfferInstall,
  isIOS,
  markInstallPromptSeen,
  onInstallAvailabilityChange,
  onTryOnSuccess,
  runInstallPrompt,
} from "@/lib/installPrompt";

/**
 * Non-intrusive, once-per-device install card. It only appears a moment after
 * a first successful try-on — never on load, never twice.
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const show = () => {
      if (!canOfferInstall()) return;
      setIos(isIOS());
      // Let the capture animation settle first — this is a nudge, not a gate.
      setTimeout(() => canOfferInstall() && setOpen(true), 1400);
    };
    const offSuccess = onTryOnSuccess(show);
    const offAvail = onInstallAvailabilityChange(() => {});
    return () => {
      offSuccess();
      offAvail();
    };
  }, []);

  if (!open) return null;

  const dismiss = () => {
    markInstallPromptSeen();
    setOpen(false);
  };

  const install = async () => {
    setBusy(true);
    setNote(null);
    try {
      const ok = await runInstallPrompt();
      if (ok) {
        setOpen(false);
        return;
      }
      setNote("Couldn't open the install dialog — use your browser menu → Add to Home Screen.");
    } catch {
      setNote("Install failed. Try your browser menu → Add to Home Screen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-none">
      <div
        role="dialog"
        aria-label="Add InkSimulator to your home screen"
        className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-white/10 bg-slate/95 backdrop-blur p-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <img
            src="/icon-192.png"
            alt=""
            className="size-10 rounded-xl border border-white/10"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Keep InkSimulator one tap away</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {ios
                ? "Tap Share, then “Add to Home Screen” — it opens full screen and you can send photos straight into it."
                : "Add it to your home screen: full-screen camera and faster try-ons."}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="size-9 -mt-1 -mr-1 grid place-items-center rounded-lg text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {note && <p className="mt-2 text-[11px] text-destructive">{note}</p>}
        <div className="mt-3 flex gap-2">
          {ios ? (
            <div className="flex-1 h-11 rounded-xl border border-white/10 text-xs font-bold flex items-center justify-center gap-2 text-muted-foreground">
              <Share className="size-4" /> Share → Add to Home Screen
            </div>
          ) : (
            <button
              onClick={() => void install()}
              disabled={busy}
              className="flex-1 h-11 rounded-xl bg-accent text-ink text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Download className="size-4" /> {busy ? "Installing…" : "Add to home screen"}
            </button>
          )}
          <button
            onClick={dismiss}
            className="h-11 px-4 rounded-xl border border-white/10 text-xs font-bold text-muted-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
