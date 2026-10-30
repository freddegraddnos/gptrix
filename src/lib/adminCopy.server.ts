// Statistics copy: every request that is emailed to a studio is also sent to
// the InkSimulator admin inbox so incoming volume can be tracked in one place.
const ADMIN_STATS_INBOX = "1891frs@gmail.com";

export async function sendAdminRequestCopy(
  template: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
) {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail(template, ADMIN_STATS_INBOX, {
      templateData,
      idempotencyKey: `${idempotencyKey}-admin-copy`,
    });
  } catch (cause) {
    console.error("[admin-copy] could not send statistics copy", cause);
  }
}
