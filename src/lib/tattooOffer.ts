/** Tattoo work availability is independent from digital-file pricing and rights. */
export const TATTOO_AVAILABILITY = ["available", "reserved", "tattooed"] as const;
export type TattooAvailability = (typeof TATTOO_AVAILABILITY)[number];
export const TATTOO_REUSE = ["unique", "repeatable", "customizable"] as const;
export type TattooReuse = (typeof TATTOO_REUSE)[number];
export type TattooOffer = {
  tattoo_availability: TattooAvailability | null;
  tattoo_reuse: TattooReuse | null;
  suggested_size_cm: number | null;
  tattoo_price_note: string | null;
};
export const EMPTY_TATTOO_OFFER: TattooOffer = {
  tattoo_availability: null,
  tattoo_reuse: null,
  suggested_size_cm: null,
  tattoo_price_note: null,
};
export const AVAILABILITY_LABELS: Record<TattooAvailability, string> = {
  available: "Available to tattoo",
  reserved: "Reserved by the artist",
  tattooed: "Already tattooed",
};
export const REUSE_LABELS: Record<TattooReuse, string> = {
  unique: "Unique design",
  repeatable: "Repeatable design",
  customizable: "Can be adapted",
};
/** Missing legacy fields must never advertise availability. */
export function readTattooOffer(row: Record<string, unknown>): TattooOffer {
  const status = TATTOO_AVAILABILITY.find((value) => value === row.tattoo_availability) ?? null;
  if (!status) return { ...EMPTY_TATTOO_OFFER };
  return {
    tattoo_availability: status,
    tattoo_reuse: TATTOO_REUSE.find((value) => value === row.tattoo_reuse) ?? null,
    suggested_size_cm:
      typeof row.suggested_size_cm === "number" && row.suggested_size_cm > 0
        ? row.suggested_size_cm
        : null,
    tattoo_price_note: typeof row.tattoo_price_note === "string" ? row.tattoo_price_note : null,
  };
}
export function validateTattooOffer(value: TattooOffer): string | null {
  if (!value.tattoo_availability) return null;
  if (
    !TATTOO_AVAILABILITY.includes(value.tattoo_availability) ||
    !value.tattoo_reuse ||
    !TATTOO_REUSE.includes(value.tattoo_reuse)
  )
    return "Choose the design's availability and repeatability.";
  if (
    value.suggested_size_cm !== null &&
    (!Number.isFinite(value.suggested_size_cm) ||
      value.suggested_size_cm <= 0 ||
      value.suggested_size_cm > 100)
  )
    return "Suggested size must be between 0 and 100 cm.";
  if ((value.tattoo_price_note?.length ?? 0) > 300)
    return "Keep the tattoo price indication under 300 characters.";
  return null;
}
