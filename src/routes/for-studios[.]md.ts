import { createFileRoute } from "@tanstack/react-router";
import markdown from "../content-for-studios.md?raw";

export const Route = createFileRoute("/for-studios.md")({
  server: {
    handlers: {
      GET: () =>
        new Response(markdown, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "X-Robots-Tag": "all",
          },
        }),
    },
  },
});
