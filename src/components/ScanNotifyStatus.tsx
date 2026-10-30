import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { decodeDelivery, type NotifyDeliveryRecord } from "@/lib/scanNotifications";
import { retryScanStageNotify } from "@/lib/bookingScan.functions";

type Entry = { id: string; at: string; retry: boolean; record: NotifyDeliveryRecord };

const REASON_TEXT: Record<string, string> = {
  muted_by_prefs: "muted in the recipient's notification settings",
  quiet_hours: "blocked by do-not-disturb",
  push_off: "push notifications are off",
  email_off: "e-mail notifications are off",
  no_registered_device: "no device registered for push",
  no_recipient: "no recipient on this booking yet",
};

/**
 * Delivery state for the automatic 3D status notifications: what was sent, to
 * whom, on which channel — and a retry button for messages that failed.
 */
export function ScanNotifyStatus({ slotId }: { slotId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("slot_events")
      .select("id, action, note, created_at")
      .eq("slot_id", slotId)
      .in("action", ["notify_result", "notify_retry"])
      .order("created_at", { ascending: false })
      .limit(10);
    const rows: Entry[] = [];
    for (const r of data ?? []) {
      const record = decodeDelivery(r.note);
      if (record) {
        rows.push({
          id: r.id,
          at: r.created_at,
          retry: r.action === "notify_retry",
          record,
        });
      }
    }
    setEntries(rows);
    setLoading(false);
  }, [slotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (entry: Entry, audience: "client" | "studio") => {
    setBusy(`${entry.id}-${audience}`);
    try {
      const res = await retryScanStageNotify({
        data: { slotId, stage: entry.record.stage, audience },
      });
      if (res.ok && (res as { failed?: number }).failed === 0) {
        toast.success("Notification sent");
      } else {
        toast.error("The notification could not be delivered");
      }
      await load();
    } catch {
      toast.error("Could not resend the notification");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-slate/30 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Notification delivery
      </p>
      <ul className="mt-2 space-y-1.5">
        {entries.map((e) =>
          e.record.results.map((r) => {
            const failedChannels = r.channels.filter((c) => !c.ok);
            return (
              <li
                key={`${e.id}-${r.audience}`}
                className="flex items-start gap-2 rounded-lg border border-white/5 bg-ink/50 px-2.5 py-2"
              >
                {r.ok ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs">
                    {e.record.label} · {r.audience === "client" ? "Client" : "Studio"}
                    {e.retry && <span className="ml-1 text-[10px] text-accent">retry</span>}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {new Date(e.at).toLocaleString()}
                    {!r.ok &&
                      failedChannels.length > 0 &&
                      ` · ${failedChannels
                        .map((c) => REASON_TEXT[c.reason ?? ""] ?? c.reason ?? "failed")
                        .join(", ")}`}
                  </span>
                </span>
                {!r.ok && (
                  <button
                    type="button"
                    onClick={() => void retry(e, r.audience)}
                    disabled={busy === `${e.id}-${r.audience}`}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 text-[10px] font-bold text-accent disabled:opacity-60"
                  >
                    {busy === `${e.id}-${r.audience}` ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Retry
                  </button>
                )}
              </li>
            );
          }),
        )}
      </ul>
    </div>
  );
}
