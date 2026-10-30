/**
 * A customer's saved idea (a row in `projects`) carried from "My ideas" through
 * studio search into the request review. Pure helpers only — no storage access
 * except the small sessionStorage handle for the active idea.
 */
export type SizeDimension = "height" | "width" | "longest";
export type SizeSource = "ar_calibrated" | "photo_calibrated" | "manual";

export type IdeaContext = {
  id: string;
  name: string;
  tattooName: string | null;
  previewUrl: string | null;
  widthCm: number | null;
  sizeDimension: SizeDimension | null;
  sizeSource: SizeSource | null;
  sizeUnsure: boolean;
  bodyPart: string | null;
  placementNote: string | null;
  placementUnsure: boolean;
  referenceIds: string[];
  referenceUrls: string[];
};

export const SIZE_DIMENSIONS: { value: SizeDimension; label: string }[] = [
  { value: "height", label: "Height" },
  { value: "width", label: "Width" },
  { value: "longest", label: "Longest side" },
];
export const SIZE_SOURCES: { value: SizeSource; label: string }[] = [
  { value: "ar_calibrated", label: "Calibrated in AR" },
  { value: "photo_calibrated", label: "Calibrated photo" },
  { value: "manual", label: "Entered manually" },
];

const KEY = "inkvision.active-idea";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIdeaId(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
export function setActiveIdea(id: string | null) {
  try {
    if (id && isIdeaId(id)) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
export function getActiveIdea(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return isIdeaId(v) ? v : null;
  } catch {
    return null;
  }
}

/** Size field value from a saved idea. Never falls back to a default number. */
export function sizeFieldFromIdea(widthCm: number | null | undefined): string {
  return widthCm != null && Number(widthCm) > 0 ? String(Number(widthCm)) : "";
}

/** Placement text from a saved idea: body part plus the placement note. */
export function placementFromIdea(idea: Pick<IdeaContext, "bodyPart" | "placementNote">): string {
  return [idea.bodyPart, idea.placementNote].filter((s) => s && s.trim()).join(" — ");
}

export function mapProjectRow(row: Record<string, unknown>, referenceUrls: string[] = []): IdeaContext {
  const dim = row.size_dimension;
  const src = row.size_source;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    tattooName: (row.tattoo_name as string | null) ?? null,
    previewUrl: ((row.cover_url ?? row.preview_url) as string | null) ?? null,
    widthCm: row.width_cm != null ? Number(row.width_cm) : null,
    sizeDimension: dim === "height" || dim === "width" || dim === "longest" ? dim : null,
    sizeSource:
      src === "ar_calibrated" || src === "photo_calibrated" || src === "manual" ? src : null,
    sizeUnsure: !!row.size_unsure,
    bodyPart: (row.body_part as string | null) ?? null,
    placementNote: (row.placement_note as string | null) ?? null,
    placementUnsure: !!row.placement_unsure,
    referenceIds: Array.isArray(row.shared_reference_ids) ? (row.shared_reference_ids as string[]) : [],
    referenceUrls,
  };
}

export type RequestShareInput = {
  motif: string | null;
  sizeCm: string;
  sizeDimension: SizeDimension | null;
  sizeSource: SizeSource | null;
  sizeUnsure: boolean;
  placement: string;
  placementUnsure: boolean;
  referenceCount: number;
  uploadCount: number;
  hasIdeaPhoto: boolean;
  description: string;
};

/** Exactly what the studio receives, in the order shown before sending. */
export function sharedItems(
  i: RequestShareInput,
  t: (s: string) => string = (s) => s,
): { key: string; label: string; value: string }[] {
  const d0 = SIZE_DIMENSIONS.find((d) => d.value === i.sizeDimension)?.label;
  const s0 = SIZE_SOURCES.find((d) => d.value === i.sizeSource)?.label;
  const dim = d0 ? t(d0) : undefined;
  const src = s0 ? t(s0) : undefined;
  const size = i.sizeUnsure && !i.sizeCm
    ? t("Unsure")
    : [i.sizeCm ? `${i.sizeCm} cm` : null, dim ? `(${dim.toLowerCase()})` : null, src ? `· ${src}` : null, i.sizeUnsure ? `· ${t("unsure")}` : null]
        .filter(Boolean)
        .join(" ");
  const placement = i.placementUnsure && !i.placement.trim()
    ? t("Unsure")
    : `${i.placement.trim()}${i.placementUnsure ? ` · ${t("unsure")}` : ""}`;
  const items = [
    { key: "motif", label: t("Design"), value: i.motif ?? "—" },
    { key: "size", label: t("Size"), value: size || "—" },
    { key: "placement", label: t("Placement"), value: placement || "—" },
    { key: "photo", label: t("Idea photo"), value: i.hasIdeaPhoto ? t("Yes") : t("No") },
    { key: "refs", label: t("References"), value: String(i.referenceCount + i.uploadCount) },
    { key: "description", label: t("Description"), value: i.description.trim() || "—" },
  ];
  return items;
}

/** Whether size/placement are answered well enough to send. */
export function sizeAndPlacementValid(i: Pick<RequestShareInput, "sizeCm" | "sizeUnsure" | "placement" | "placementUnsure">) {
  const n = Number(i.sizeCm);
  const sizeOk = i.sizeUnsure || (i.sizeCm !== "" && n > 0 && n <= 100);
  const placementOk = i.placementUnsure || i.placement.trim().length >= 2;
  return sizeOk && placementOk;
}
