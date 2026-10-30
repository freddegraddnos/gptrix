import { createFileRoute } from "@tanstack/react-router";

/** Fortnox OAuth redirect target: stores the studio's connection. */
export const Route = createFileRoute("/api/public/fortnox/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { fortnoxConfig, verifyState, exchangeCodeAndSave } = await import(
          "@/lib/fortnox.server"
        );
        const url = new URL(request.url);
        const back = (q: string) =>
          Response.redirect(new URL(`/artists/dashboard?fortnox=${q}`, url.origin), 302);
        const cfg = fortnoxConfig();
        if (!cfg) return new Response("Fortnox is not set up for this app yet.", { status: 503 });
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return back("denied");
        const parsed = verifyState(state, cfg.clientSecret);
        if (!parsed) return back("expired");
        try {
          await exchangeCodeAndSave(parsed.studioId, code, parsed.origin);
          return back("connected");
        } catch (cause) {
          console.error("[fortnox] callback failed", cause);
          return back("failed");
        }
      },
    },
  },
});
