import { describe, expect, it } from "vitest";
import { EMPTY_TATTOO_OFFER, readTattooOffer, validateTattooOffer } from "../src/lib/tattooOffer";

describe("artist tattoo availability, independent of digital sales", () => {
  it("does not label old free or paid files as available tattoos", () => {
    for (const price_ore of [0, 19000])
      expect(readTattooOffer({ price_ore })).toEqual(EMPTY_TATTOO_OFFER);
  });
  it("requires the artist to choose repeatability explicitly", () => {
    expect(
      validateTattooOffer({ ...EMPTY_TATTOO_OFFER, tattoo_availability: "available" }),
    ).not.toBeNull();
  });
  it("preserves reserved/tattooed and never converts an enquiry to availability", () => {
    for (const status of ["reserved", "tattooed"] as const) {
      const value = readTattooOffer({
        tattoo_availability: status,
        tattoo_reuse: "unique",
        suggested_size_cm: 12,
      });
      expect(value.tattoo_availability).toBe(status);
      expect(validateTattooOffer(value)).toBeNull();
      expect(value).not.toHaveProperty("price_ore");
      expect(value).not.toHaveProperty("usage_terms");
    }
  });
  it("rejects invalid estimates and overlong price notes", () => {
    const base = {
      ...EMPTY_TATTOO_OFFER,
      tattoo_availability: "available",
      tattoo_reuse: "customizable",
    } as const;
    for (const suggested_size_cm of [0, -1, 101, NaN, Infinity])
      expect(validateTattooOffer({ ...base, suggested_size_cm })).not.toBeNull();
    expect(
      validateTattooOffer({
        ...base,
        suggested_size_cm: 12.5,
        tattoo_price_note: "From 1500 kr, confirmed after consultation",
      }),
    ).toBeNull();
    expect(validateTattooOffer({ ...base, tattoo_price_note: "a".repeat(301) })).not.toBeNull();
  });
  it("clearing a listing never repurposes its digital rights or price", () => {
    expect(
      readTattooOffer({
        tattoo_availability: null,
        tattoo_reuse: "unique",
        usage_terms: "Existing terms",
        price_ore: 19000,
      }),
    ).toEqual(EMPTY_TATTOO_OFFER);
  });
});
