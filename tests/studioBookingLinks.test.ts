import { describe, expect, it } from "vitest";
import { studioBookingPath, studioBookingUrl } from "../src/lib/studioBookingLinks";

const id = "12345678-1234-1234-1234-123456789abc";

describe("private studio booking notification links", () => {
  it("uses the studio-only route for standard requests", () => {
    expect(studioBookingPath(id)).toBe(`/artists/bookings/${id}`);
    expect(studioBookingUrl(id)).toBe(`https://www.inksimulator.com/artists/bookings/${id}`);
  });
  it("uses a separate route for agent requests", () => {
    expect(studioBookingPath(id, true)).toBe(`/artists/agent-bookings/${id}`);
    expect(studioBookingUrl(id, true)).toBe(`https://www.inksimulator.com/artists/agent-bookings/${id}`);
  });
  it("never puts customer data or arbitrary paths into the notice URL", () => {
    expect(() => studioBookingPath("../../requests?email=customer@example.com")).toThrow();
  });
});