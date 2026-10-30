import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { studioBookingPath, studioBookingUrl } from "./studioBookingUrl";

describe("canonical studio booking address", () => {
  test("1891frs uses the short public booking address", () => {
    assert.equal(studioBookingPath("1891frs"), "/1891frs/book");
    assert.equal(studioBookingUrl("1891frs"), "https://www.inksimulator.com/1891frs/book");
  });

  test("handles are encoded before sharing", () => {
    assert.equal(studioBookingPath("studio test"), "/studio%20test/book");
  });
});