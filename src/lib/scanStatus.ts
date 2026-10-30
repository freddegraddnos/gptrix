import type { BookingFile } from "@/lib/bookingFiles";

/**
 * The 3D pipeline of a booking, derived automatically from the delivery log
 * so the client and the studio always see the same stage without anyone
 * having to flip a status by hand.
 */
export type ScanStage = "requested" | "in_progress" | "revised" | "delivered";

export type ScanStatus = {
  stage: ScanStage;
  label: string;
  hint: string;
  /** ISO timestamp of the event that produced the current stage. */
  at: string | null;
  /** Latest 3D delivery version from the studio, if any. */
  studioVersion: number;
};

export const SCAN_STAGES: { id: ScanStage; label: string }[] = [
  { id: "requested", label: "Scan requested" },
  { id: "in_progress", label: "In progress" },
  { id: "revised", label: "Revised" },
  { id: "delivered", label: "Delivered" },
];

export function stageIndex(stage: ScanStage) {
  return SCAN_STAGES.findIndex((s) => s.id === stage);
}

/**
 * Maps booking state + shared 3D files onto the four visible stages:
 * requested → in progress (a scan exists) → revised (studio sent an updated
 * model back) → delivered (studio's latest model is the final one).
 */
export function deriveScanStatus(input: {
  scanDeliveredAt?: string | null;
  files: BookingFile[];
}): ScanStatus {
  const models = input.files.filter((f) => f.is3d);
  const studioModels = models.filter((f) => f.uploader_role === "studio");
  const clientModels = models.filter((f) => f.uploader_role !== "studio");
  const newest = <T extends { created_at: string }>(list: T[]) =>
    list.reduce<T | null>(
      (a, b) => (!a || new Date(b.created_at) > new Date(a.created_at) ? b : a),
      null,
    );

  const lastStudio = newest(studioModels);
  const lastClient = newest(clientModels);

  if (lastStudio) {
    const newerScan =
      lastClient && new Date(lastClient.created_at) > new Date(lastStudio.created_at);
    if (newerScan) {
      return {
        stage: "revised",
        label: "Revised",
        hint: "A new scan arrived after the studio's file — they are reworking the design.",
        at: lastClient.created_at,
        studioVersion: lastStudio.version,
      };
    }
    return {
      stage: "delivered",
      label: "Delivered",
      hint: `The studio's adjusted 3D file (v${lastStudio.version}) is ready to open.`,
      at: lastStudio.created_at,
      studioVersion: lastStudio.version,
    };
  }

  const scannedAt = lastClient?.created_at ?? input.scanDeliveredAt ?? null;
  if (scannedAt) {
    return {
      stage: "in_progress",
      label: "In progress",
      hint: "Your scan is with the studio — they are adjusting the design to your body.",
      at: scannedAt,
      studioVersion: 0,
    };
  }

  return {
    stage: "requested",
    label: "Scan requested",
    hint: "The studio needs a 3D body scan before the piece can be planned.",
    at: null,
    studioVersion: 0,
  };
}
