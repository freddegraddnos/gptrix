import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const body = z.object({
  sessionKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9-]+$/),
  message: z.string().trim().min(1).max(1500),
});

export const Route = createFileRoute("/api/public/agent/$handle")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
        const { runAgent } = await import("@/lib/agent.server");
        const out = await runAgent(params.handle, parsed.data.sessionKey, parsed.data.message);
        return Response.json(out, { status: "error" in out ? (out.error === "not_active" ? 404 : 429) : 200 });
      },
    },
  },
});
