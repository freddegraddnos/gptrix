import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { currentPushSubscription, enablePush, pushSupported } from "@/lib/push";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";

/**
 * One-tap prompt that turns on push notifications for this device, so the
 * customer is alerted immediately when the studio sends a message, uploads a
 * new sketch version or requests a deposit. Hidden when push is unsupported,
 * already enabled, or permanently blocked in the browser.
 */
export function EnablePushPrompt({ userId }: { userId: string | undefined }) {
  const { save } = useNotificationPrefs(userId);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    if (typeof Notification !== "undefined" && Notification.permission === "denied") return;
    void currentPushSubscription().then((sub) => {
      if (!sub) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const res = await enablePush();
      if (!res.ok) {
        toast.error(res.error ?? "Could not enable notifications");
        return;
      }
      await save({ push_enabled: true });
      toast.success("Notifications on — you'll know the moment the studio replies");
      setVisible(false);
    } catch {
      toast.error("Could not enable notifications");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-3.5">
      <BellRing className="size-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Get instant updates</p>
        <p className="text-xs text-muted-foreground">
          Know right away when the studio messages you, uploads a new sketch or requests the deposit.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void enable()}
        disabled={busy}
        className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-foreground disabled:opacity-50"
      >
        {busy ? "Enabling…" : "Turn on"}
      </button>
    </div>
  );
}
