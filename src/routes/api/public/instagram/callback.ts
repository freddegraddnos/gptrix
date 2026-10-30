import { createFileRoute } from "@tanstack/react-router";

/** Instagram OAuth redirect target: stores the studio's connection. */
export const Route = createFileRoute("/api/public/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { instagramConfig, verifyState, exchangeCode, saveInstagramLink } =
          await import("@/lib/instagram.server");
        const config = instagramConfig();
        if (!config)
          return new Response("Instagram is not set up for this app yet.", { status: 503 });

        const url = new URL(request.url);
        const code = url.searchParams.get("code")?.replace(/#_$/, "") ?? null;
        const state = url.searchParams.get("state");
        if (!code || !state)
          return Response.redirect(new URL("/artists/dashboard?instagram=denied", url.origin), 302);

        const studioId = verifyState(state, config.appSecret);
        if (!studioId)
          return Response.redirect(new URL("/artists/dashboard?instagram=expired", url.origin), 302);

        try {
          const link = await exchangeCode(config, code, url.origin);
          await saveInstagramLink(studioId, link);
          return Response.redirect(new URL("/artists/inbox?instagram=connected", url.origin), 302);
        } catch (cause) {
          console.error("[instagram] callback failed", cause);
          return Response.redirect(new URL("/artists/dashboard?instagram=failed", url.origin), 302);
        }
      },
    },
  },
});
