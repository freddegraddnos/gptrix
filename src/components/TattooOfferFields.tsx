import { tx } from "@/lib/uiLang";
import {
  AVAILABILITY_LABELS,
  EMPTY_TATTOO_OFFER,
  REUSE_LABELS,
  TATTOO_AVAILABILITY,
  TATTOO_REUSE,
  type TattooOffer,
  type TattooAvailability,
  type TattooReuse,
} from "@/lib/tattooOffer";

export function TattooOfferFields({
  value,
  onChange,
  disabled = false,
}: {
  value: TattooOffer;
  onChange: (value: TattooOffer) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-bold">{tx("Tattoo work availability")}</legend>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={value.tattoo_availability !== null}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { ...value, tattoo_availability: "available", tattoo_reuse: null }
                : { ...EMPTY_TATTOO_OFFER },
            )
          }
        />
        {tx("List this as a design I want to tattoo")}
      </label>
      <p className="text-xs text-muted-foreground">
        {tx(
          "This describes tattoo work, not a digital-file purchase. Existing usage terms still apply. Enquiries never reserve a design automatically.",
        )}
      </p>
      {value.tattoo_availability !== null && (
        <>
          <label className="block text-sm">
            {tx("Availability")}
            <select
              value={value.tattoo_availability}
              onChange={(e) =>
                onChange({ ...value, tattoo_availability: e.target.value as TattooAvailability })
              }
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
            >
              {TATTOO_AVAILABILITY.map((status) => (
                <option key={status} value={status}>
                  {tx(AVAILABILITY_LABELS[status])}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {tx("Repeatability")}
            <select
              value={value.tattoo_reuse ?? ""}
              onChange={(e) => onChange({ ...value, tattoo_reuse: e.target.value as TattooReuse })}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
            >
              <option value="" disabled>
                {tx("Choose")}
              </option>
              {TATTOO_REUSE.map((kind) => (
                <option key={kind} value={kind}>
                  {tx(REUSE_LABELS[kind])}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {tx("Suggested size in cm (optional)")}
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={value.suggested_size_cm ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  suggested_size_cm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
            />
          </label>
          <label className="block text-sm">
            {tx("Tattoo price indication (optional)")}
            <input
              maxLength={300}
              value={value.tattoo_price_note ?? ""}
              onChange={(e) => onChange({ ...value, tattoo_price_note: e.target.value || null })}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
            />
          </label>
        </>
      )}
    </fieldset>
  );
}
