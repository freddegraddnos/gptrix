import { createServerFn } from "@tanstack/react-start";
import { studioInterestSchema } from "@/lib/studioInterest.schema";

export const sendStudioInterest = createServerFn({ method: "POST" })
  .inputValidator((input) => studioInterestSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true };
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${data.email.toLowerCase()}|${data.studioName.toLowerCase()}`),
    );
    const key = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const result = await sendTemplateEmail("studio-interest", "", {
      templateData: {
        studioName: data.studioName,
        contactName: data.contactName,
        contactEmail: data.email,
        phone: data.phone,
      },
      replyTo: data.email,
      idempotencyKey: `studio-interest-${key}`,
    });
    return { ok: result.sent };
  });
