import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { template as studio } from "../src/lib/email-templates/booking-request";
import { template as customer } from "../src/lib/email-templates/booking-received";

const photoUrl = "https://example.com/storage/v1/object/sign/project-previews/test/photo.png?token=test";

describe.each([ ["studio", studio], ["customer", customer] ] as const)("%s booking email photo", (_name, template) => {
  it("shows the saved photo, motif size and a direct image link", async () => {
    const html = await render(React.createElement(template.component, { photoUrl, bodyArea: "Forearm", sizeCm: "12" }));
    expect(html).toContain(`src="${photoUrl}"`);
    expect(html).toContain(`href="${photoUrl}"`);
    expect(html).toContain("Booking photo — Forearm · 12 cm");
    expect(html).toContain("View booking photo");
  });
  it("omits the image when the booking has no photo", async () => {
    const html = await render(React.createElement(template.component, {}));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("View booking photo");
  });
});