import { publicSiteUrl } from "@/lib/publicOrigin";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";




type NotifyInput = { conversationId: string; preview: string };

/**
 * Sends an e-mail notification to the other member of a conversation when a
 * new message arrives. Silently skips when the recipient has turned e-mail
 * notifications off, or when e-mail sending is not yet available.
 */
export const notifyNewMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NotifyInput) => ({
    conversationId: String(input.conversationId),
    preview: String(input.preview ?? "").slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must be a member of the conversation (RLS enforces this too).
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId);
    const ids = (members ?? []).map((m) => m.user_id);
    if (!ids.includes(userId)) return { sent: false, reason: "not_member" };
    const recipientId = ids.find((id) => id !== userId);
    if (!recipientId) return { sent: false, reason: "no_recipient" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: recipientProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email_message_notifications")
      .eq("id", recipientId)
      .maybeSingle();
    if (recipientProfile && recipientProfile.email_message_notifications === false) {
      return { sent: false, reason: "opted_out" };
    }

    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const senderName = senderProfile?.display_name ?? "Someone";

    // Prefer the studio contact e-mail, fall back to the account e-mail.
    const { data: artist } = await supabaseAdmin
      .from("artist_profiles")
      .select("contact_email")
      .eq("user_id", recipientId)
      .maybeSingle();
    let to = artist?.contact_email ?? null;
    if (!to) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(recipientId);
      to = authUser?.user?.email ?? null;
    }
    if (!to) return { sent: false, reason: "no_email" };

    const link = publicSiteUrl("/messages");

    // In-app bell + push, regardless of whether the e-mail goes through.
    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(recipientId, {
      kind: "message",
      title: `New message from ${senderName}`,
      body: `${senderName}: ${data.preview}`,
      url: `/messages/${data.conversationId}`,
      inApp: {
        kind: "message",
        actorId: userId,
        conversationId: data.conversationId,
      },
    }).catch(() => undefined);

    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("new-message", to, {
        templateData: { senderName, preview: data.preview, link },
        idempotencyKey: `new-message-${data.conversationId}-${userId}-${Date.now()}`,
      });
      return result;
    } catch (err) {
      console.error("[messages] email notification failed", err);
      return { sent: false, reason: "send_failed" };
    }
  });

