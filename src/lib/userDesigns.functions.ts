/**
 * Designs (drawings, lettering, uploads, AI motifs) saved to the signed-in
 * user's account so they survive signing out or switching device.
 * Files live in the private "designs" bucket under {userId}/...
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserDesign = {
  id: string;
  name: string;
  kind: "upload" | "drawing" | "text" | "ai" | "sleeve";
  widthCm: number;
  localId: string | null;
  createdAt: string;
  /** Signed URL, valid for an hour. */
  url: string | null;
};

const KINDS = ["upload", "drawing", "text", "ai", "sleeve"] as const;

async function sign(
  supabase: any,
  rows: Array<{ storage_path: string }>,
): Promise<Array<string | null>> {
  return Promise.all(
    rows.map(async (r) => {
      const { data } = await supabase.storage
        .from("designs")
        .createSignedUrl(r.storage_path, 3600);
      return data?.signedUrl ?? null;
    }),
  );
}

export const listUserDesigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserDesign[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_designs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const urls = await sign(supabase, rows);
    return rows.map((r: any, i: number) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      widthCm: Number(r.width_cm ?? 8),
      localId: r.local_id ?? null,
      createdAt: r.created_at,
      url: urls[i] ?? null,
    }));
  });

const saveSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(KINDS).default("upload"),
  widthCm: z.number().min(0.5).max(200).default(8),
  localId: z.string().max(64).nullable().optional(),
  /** PNG as a data URL. */
  dataUrl: z.string().startsWith("data:image/").max(14_000_000),
});

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Design must be a base64 image");
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, type: match[1]! };
}

export const saveUserDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => saveSchema.parse(raw))
  .handler(async ({ data, context }): Promise<UserDesign> => {
    const { supabase, userId } = context;

    if (data.localId) {
      const { data: existing } = await supabase
        .from("user_designs")
        .select("id")
        .eq("user_id", userId)
        .eq("local_id", data.localId)
        .maybeSingle();
      if (existing) {
        const list = await supabase
          .from("user_designs")
          .select("*")
          .eq("id", existing.id)
          .single();
        const urls = await sign(supabase, [list.data as any]);
        const r = list.data as any;
        return {
          id: r.id,
          name: r.name,
          kind: r.kind,
          widthCm: Number(r.width_cm ?? 8),
          localId: r.local_id ?? null,
          createdAt: r.created_at,
          url: urls[0] ?? null,
        };
      }
    }

    const { bytes, type } = dataUrlToBytes(data.dataUrl);
    const ext = type.includes("jpeg") ? "jpg" : type.split("/")[1] || "png";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("designs")
      .upload(path, bytes, { contentType: type, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error } = await supabase
      .from("user_designs")
      .insert({
        user_id: userId,
        name: data.name,
        kind: data.kind,
        width_cm: data.widthCm,
        local_id: data.localId ?? null,
        storage_path: path,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const urls = await sign(supabase, [row as any]);
    return {
      id: row.id,
      name: row.name,
      kind: row.kind as UserDesign["kind"],
      widthCm: Number(row.width_cm ?? 8),
      localId: row.local_id ?? null,
      createdAt: row.created_at,
      url: urls[0] ?? null,
    };
  });

export const renameUserDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(120) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_designs")
      .update({ name: data.name })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("user_designs")
      .select("storage_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from("designs").remove([row.storage_path]);
    }
    const { error } = await supabase
      .from("user_designs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
