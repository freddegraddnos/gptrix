import type { ScanStage } from "@/lib/scanStatus";

export type NotifyAudience = "client" | "studio";

export type ScanStageMessage = { title: string; body: string };

export const SCAN_STAGE_LABEL: Record<ScanStage, string> = {
  requested: "Scan requested",
  in_progress: "In progress",
  revised: "Revised",
  delivered: "Delivered",
};

/**
 * The exact wording sent to each side when the 3D pipeline of a booking moves
 * to a new stage. Shared by the server notifier and the in-app preview so what
 * is previewed is byte-for-byte what gets sent.
 */
export function buildScanStageMessage(
  stage: ScanStage,
  audience: NotifyAudience,
  when: string,
): ScanStageMessage {
  const label = SCAN_STAGE_LABEL[stage];
  const title = `3D status: ${label}`;
  const forClient: Record<ScanStage, string> = {
    requested: `The studio needs a 3D body scan before your booking on ${when} can be planned.`,
    in_progress: `Your scan for the booking on ${when} is with the studio — they are adjusting the design to your body.`,
    revised: `A new scan was added to the booking on ${when}; the studio is reworking the design.`,
    delivered: `The studio's adjusted 3D file for the booking on ${when} is ready to open.`,
  };
  const forStudio: Record<ScanStage, string> = {
    requested: `You marked the booking on ${when} as requiring a 3D body scan. The client has been asked to send one.`,
    in_progress: `A 3D scan arrived for the booking on ${when} and is ready to adjust.`,
    revised: `The client sent an updated scan for the booking on ${when} after your last delivery.`,
    delivered: `Your adjusted 3D file for the booking on ${when} was delivered to the client.`,
  };
  return { title, body: audience === "client" ? forClient[stage] : forStudio[stage] };
}

export type NotifyChannelResult = {
  channel: string;
  target: string;
  ok: boolean;
  reason?: string;
};

export type NotifyDeliveryRecord = {
  stage: ScanStage;
  label: string;
  results: { audience: NotifyAudience; ok: boolean; channels: NotifyChannelResult[] }[];
};

/** Serialises a delivery record into a slot_events note (text column). */
export function encodeDelivery(rec: NotifyDeliveryRecord) {
  return JSON.stringify(rec).slice(0, 3000);
}

export function decodeDelivery(note: string | null): NotifyDeliveryRecord | null {
  if (!note) return null;
  try {
    const parsed = JSON.parse(note) as NotifyDeliveryRecord;
    return parsed?.stage ? parsed : null;
  } catch {
    return null;
  }
}
