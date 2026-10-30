import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAgentStudio = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ handle: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { loadAgentStudio } = await import("@/lib/agent.server");
    const r = await loadAgentStudio(data.handle);
    if (!r) return null;
    return { name: r.studio.studio_name as string, city: (r.studio.city ?? null) as string | null, handle: r.studio.handle as string, movedTo: (r.movedTo ?? null) as string | null, enabled: Boolean(r.settings?.enabled), lang: (r.settings?.language === "en" ? "en" : "sv") as "sv" | "en" };
  });
