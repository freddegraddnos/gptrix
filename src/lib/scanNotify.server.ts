import type { ScanStage } from "@/lib/scanStatus";
import {
  buildScanStageMessage,
  encodeDelivery,
  SCAN_STAGE_LABEL,
  type NotifyAudience,
  type NotifyChannelResult,
  type NotifyDeliveryRecord,
} from "@/lib/scanNotifications";

/**
 * Sends the stage notification to one or both parties of a booking and writes
 * a delivery record to the booking timeline, so failures stay visible and can
 * be retried from the delivery log.
 */
export async function deliverScanStage(input: {
  slotId: string;
  stage: ScanStage;
  actorId: string;
  audiences?: NotifyAudience[];
  retry?: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { notifyUser } = await import("@/lib/notify.server");

  const { data: slot } = await supabaseAdmin
    .from("studio_slots")
    .select("id, studio_id, booked_by, starts_at")
    .eq("id", input.slotId)
    .maybeSingle();
  if (!slot) return { ok: false as const, reason: "not_found" };

  const when = slot.starts_at ? new Date(slot.starts_at).toLocaleString() : "your booking";
  const label = SCAN_STAGE_LABEL[input.stage];
  const targets: { audience: NotifyAudience; userId: string | null }[] = [
    { audience: "client", userId: slot.booked_by },
    { audience: "studio", userId: slot.studio_id },
  ].filter(
    (t) => !input.audiences || input.audiences.includes(t.audience as NotifyAudience),
  ) as { audience: NotifyAudience; userId: string | null }[];

  const record: NotifyDeliveryRecord = { stage: input.stage, label, results: [] };

  for (const t of targets) {
    if (!t.userId) {
      record.results.push({
        audience: t.audience,
        ok: false,
        channels: [{ channel: "any", target: t.audience, ok: false, reason: "no_recipient" }],
      });
      continue;
    }
    const msg = buildScanStageMessage(input.stage, t.audience, when);
    try {
      const res = await notifyUser(t.userId, {
        kind: "scan",
        title: msg.title,
        body: msg.body,
        url: "/bookings/activity",
        inApp: { kind: "booking", actorId: input.actorId },
      });
      const channels: NotifyChannelResult[] = (res.details ?? []).map((d) => ({
        channel: d.channel,
        target: d.target,
        ok: d.ok,
        reason: d.reason,
      }));
      const ok = res.skipped ? false : channels.some((c) => c.ok) || channels.length === 0;
      if (res.skipped) {
        channels.push({
          channel: "any",
          target: t.audience,
          ok: false,
          reason: "muted_by_prefs",
        });
      }
      record.results.push({ audience: t.audience, ok, channels });
    } catch (err) {
      record.results.push({
        audience: t.audience,
        ok: false,
        channels: [
          {
            channel: "any",
            target: t.audience,
            ok: false,
            reason: err instanceof Error ? err.message : "send_failed",
          },
        ],
      });
    }
  }

  await supabaseAdmin.from("slot_events").insert({
    slot_id: input.slotId,
    actor_id: input.actorId,
    actor_role: slot.studio_id === input.actorId ? "studio" : "client",
    action: input.retry ? "notify_retry" : "notify_result",
    note: encodeDelivery(record),
  });

  return {
    ok: true as const,
    record,
    failed: record.results.filter((r) => !r.ok).length,
    notified: record.results.filter((r) => r.ok).length,
  };
}
