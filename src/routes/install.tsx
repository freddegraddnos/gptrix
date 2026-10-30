import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Share, Smartphone, Check, Plus } from "lucide-react";
import {
  hasNativeInstallPrompt,
  isIOS,
  isStandalone,
  onInstallAvailabilityChange,
  runInstallPrompt,
} from "@/lib/installPrompt";

export const Route = createFileRoute("/install")({
  component: InstallPage,
  head: () => ({
    meta: [
      { title: "Install InkSimulator — the AR tattoo app on your home screen" },
      {
        name: "description",
        content:
          "Add InkSimulator to your phone's home screen and try tattoos on your skin in full-screen AR — no browser, no app store.",
      },
      { property: "og:title", content: "Install InkSimulator on your phone" },
      {
        property: "og:description",
        content:
          "Full-screen AR tattoo try-on straight from your home screen. Add InkSimulator in two taps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
        {n}
      </span>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <p className="text-[12px] text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function InstallPage() {
  const [native, setNative] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setNative(hasNativeInstallPrompt());
      setIos(isIOS());
      setInstalled(isStandalone());
    };
    sync();
    const off = onInstallAvailabilityChange(sync);
    return () => {
      off();
    };
  }, []);

  const install = async () => {
    setBusy(true);
    setNote(null);
    try {
      const ok = await runInstallPrompt();
      if (ok) setInstalled(true);
      else setNote("Install dialog closed. You can also use your browser menu → Add to Home screen.");
    } catch {
      setNote("Install failed. Use your browser menu → Add to Home screen.");
    } finally {
      setBusy(false);
      setNative(hasNativeInstallPrompt());
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-8">
      <div className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-slate/70">
        <Smartphone className="size-6 text-accent" />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
        Install InkSimulator on your phone
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add it to your home screen and the AR camera opens full screen — no browser bars, no app
        store, and your saved designs stay with you.
      </p>

      {installed ? (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm font-bold text-accent">
          <Check className="size-4" /> InkSimulator is installed — you're running the app version.
        </div>
      ) : native ? (
        <>
          <button
            onClick={() => void install()}
            disabled={busy}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-ink disabled:opacity-60"
          >
            <Download className="size-4" /> {busy ? "Installing…" : "Add to home screen"}
          </button>
          {note && <p className="mt-2 text-[12px] text-destructive">{note}</p>}
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {ios ? <Share className="size-4" /> : <Plus className="size-4" />}
            {ios ? "iPhone / iPad — Safari" : "Android — Chrome"}
          </div>
          <ol className="space-y-3">
            {ios ? (
              <>
                <Step n={1} title="Open this page in Safari" body="Chrome and in-app browsers on iOS can't install web apps." />
                <Step n={2} title="Tap the Share button" body="The square with an arrow, in the bottom bar." />
                <Step n={3} title="Choose “Add to Home Screen”" body="Then tap Add — InkSimulator appears as an app icon." />
              </>
            ) : (
              <>
                <Step n={1} title="Open the browser menu" body="The three dots in the top right corner." />
                <Step n={2} title="Tap “Install app” or “Add to Home screen”" body="Chrome, Edge and Samsung Internet all support this." />
                <Step n={3} title="Confirm" body="InkSimulator launches full screen from your home screen." />
              </>
            )}
          </ol>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {[
          ["Full-screen AR camera", "More room for the try-on, no address bar in the way."],
          ["Faster launch", "One tap from the home screen straight into the camera."],
          ["Booking notifications", "Get push alerts when a studio replies or confirms a time."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-xl border border-white/10 bg-slate/40 p-3">
            <div className="text-sm font-bold">{t}</div>
            <p className="text-[12px] text-muted-foreground">{b}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
