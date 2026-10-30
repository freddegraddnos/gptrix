import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { robotsText } from "@/lib/robots";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(robotsText(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
