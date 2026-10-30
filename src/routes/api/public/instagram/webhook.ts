import { createFileRoute } from "@tanstack/react-router";

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ payload?: { url?: string } }>;
  };
};

/**
 * Meta webhook for Instagram DMs. GET answers the subscription challenge,
 * POST stores incoming messages after verifying Meta's request signature.
 */
export const Route = createFileRoute("/api/public/instagram/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { instagramConfig } = await import("@/lib/instagram.server");
        const config = instagramConfig();
        if (!config) return new Response("Not configured", { status: 503 });
        const url = new URL(request.url);
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === config.verifyToken
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const { instagramConfig, verifyWebhookSignature, recordInstagramMessage } = await import(
          "@/lib/instagram.server"
        );
        const config = instagramConfig();
        if (!config) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"), config.appSecret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { entry?: Array<{ id?: string; messaging?: MessagingEvent[] }> };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        for (const entry of payload.entry ?? []) {
          for (const event of entry.messaging ?? []) {
            const message = event.message;
            if (!message) continue;
            const isEcho = message.is_echo === true;
            const studioIgId = isEcho ? event.sender?.id : event.recipient?.id;
            const participantId = isEcho ? event.recipient?.id : event.sender?.id;
            if (!studioIgId || !participantId) continue;

            const { data: link } = await supabaseAdmin
              .from("studio_instagram_links")
              .select("studio_id")
              .eq("ig_user_id", studioIgId)
              .maybeSingle();
            if (!link) continue;

            try {
              const stored = await recordInstagramMessage({
                studioId: link.studio_id,
                participantId,
                direction: isEcho ? "out" : "in",
                body: message.text ?? null,
                attachmentUrl: message.attachments?.[0]?.payload?.url ?? null,
                igMessageId: message.mid ?? null,
              });

              if (!isEcho && stored.messageId) {
                const { notifyUser } = await import("@/lib/notify.server");
                await notifyUser(link.studio_id, {
                  kind: "message",
                  title: "New Instagram message",
                  body: (message.text ?? "Sent an attachment").slice(0, 120),
                  url: "/artists/inbox",
                  inApp: { kind: "message" },
                }).catch(() => undefined);
              }
            } catch (cause) {
              console.error("[instagram] webhook store failed", cause);
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
