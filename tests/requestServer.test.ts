import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  notified: vi.fn(),
  motif: null as Record<string, unknown> | null,
  failHandle: null as string | null,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (v: unknown) => v;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (args: unknown) => Promise<unknown>) => (args: { data: unknown; context: unknown }) =>
          fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/ageVerification.functions", () => ({ assertAgeVerified: vi.fn() }));
vi.mock("@/lib/notify.server", () => ({ notifyUser: fake.notified }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
    from: (table: string) => {
      let id: string;
      let insert: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        eq: (_key: string, value: string) => {
          id = value;
          return query;
        },
        maybeSingle: async () => ({
          data: table === "artist_client_projects" ? (fake.rows.get(id) ?? null) : null,
          error: null,
        }),
        insert: (row: Record<string, unknown>) => {
          insert = row;
          return query;
        },
        single: async () => {
          if (!insert) throw new Error("Missing insertion");
          const key = String(insert.id);
          if (fake.rows.has(key)) return { data: null, error: { code: "23505" } };
          fake.rows.set(key, insert);
          return { data: insert, error: null };
        },
      };
      return query;
    },
  },
}));
import { createArtistRequest, createArtistRequests } from "../src/lib/projectRequests.functions";
const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const STUDIO = "22222222-2222-4222-8222-222222222222";
const MOTIF = "33333333-3333-4333-8333-333333333333";
const KEY = "44444444-4444-4444-8444-444444444444";
function context(userId = CUSTOMER) {
  return {
    userId,
    supabase: {
      rpc: async (name: string, args?: { _handle?: string }) => {
        if (args?._handle && args._handle === fake.failHandle)
          throw new Error("Temporary lookup failure");
        return {
          data:
            name === "is_any_studio_account"
              ? false
              : name === "booking_adult_declared"
                ? true
                : {
                    user_id:
                      args?._handle === "second-studio"
                        ? "55555555-5555-4555-8555-555555555555"
                        : STUDIO,
                    studio_name: "Test studio",
                  },
          error: null,
        };
      },
      from: () => {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: fake.motif, error: null }),
        };
        return q;
      },
    },
  };
}
const data = {
  studioHandle: "existing-studio",
  requestKey: KEY,
  sourceMotifId: MOTIF,
  name: "Test client",
  email: "client@example.test",
  phone: "12345",
  placement: "",
  sizeUnsure: true,
  placementUnsure: true,
  description: "Question about this design",
  colorMode: "black-grey",
};
const call = (ctx = context(), input = data) =>
  (createArtistRequest as unknown as (args: unknown) => Promise<{ id: string }>)({
    data: input,
    context: ctx,
  });
beforeEach(async () => {
  await import("@/integrations/supabase/client.server");
  await import("@/lib/notify.server");
  fake.rows.clear();
  fake.failHandle = null;
  fake.notified.mockReset().mockResolvedValue(undefined);
  fake.motif = {
    id: MOTIF,
    artist_id: STUDIO,
    name: "Existing design",
    usage_terms: "Artist terms",
    placements: ["forearm"],
  };
});
describe("authenticated artist intake handler", () => {
  it("snapshots the selected artist design and creates/notifies only once on retry", async () => {
    const result = [await call(), await call()];
    expect(result.map((r) => r.id)).toEqual([KEY, KEY]);
    expect(fake.rows.size).toBe(1);
    expect(fake.notified).toHaveBeenCalledTimes(1);
    expect(fake.rows.get(KEY)?.source_motif_id).toBe(MOTIF);
    expect(fake.rows.get(KEY)?.source_motif_snapshot).toEqual(fake.motif);
  });
  it("keeps the advertised offer as sent without reserving or changing the motif", async () => {
    fake.motif = {
      ...fake.motif,
      tattoo_availability: "available",
      tattoo_reuse: "unique",
      suggested_size_cm: 12,
      tattoo_price_note: "After consultation",
    };
    await call();
    expect(fake.motif.tattoo_availability).toBe("available");
    fake.motif = { ...fake.motif, tattoo_availability: "tattooed", tattoo_price_note: "Changed" };
    await call();
    expect(fake.rows.get(KEY)?.source_motif_snapshot).toMatchObject({
      tattoo_availability: "available",
      tattoo_reuse: "unique",
      suggested_size_cm: 12,
      tattoo_price_note: "After consultation",
    });
  });
  it("rejects a motive from another studio before creating a request", async () => {
    fake.motif = { ...fake.motif, artist_id: CUSTOMER };
    await expect(call()).rejects.toThrow("selected studio");
    expect(fake.rows.size).toBe(0);
    expect(fake.notified).not.toHaveBeenCalled();
  });
  it("rejects unpublished or missing designs", async () => {
    fake.motif = null;
    await expect(call()).rejects.toThrow("selected studio");
    expect(fake.rows.size).toBe(0);
  });
  it("rejects reuse of another customer's request UUID", async () => {
    await call();
    await expect(call(context(STUDIO))).rejects.toThrow("different request");
    expect(fake.notified).toHaveBeenCalledTimes(1);
  });
  it("does not silently edit an already sent brief on retry", async () => {
    await call();
    await call(context(), { ...data, description: "Changed later" });
    expect(fake.rows.get(KEY)?.description).toContain("Question about this design");
    expect(fake.rows.get(KEY)?.description).not.toContain("Changed later");
  });
});

describe("multi-studio idempotency", () => {
  const submit = async (
    handles = ["existing-studio", "second-studio"],
    description = data.description,
  ) =>
    (
      createArtistRequests as unknown as (
        a: unknown,
      ) => Promise<{ projects: { id: string; studioHandle: string }[] }>
    )({ data: { ...data, studioHandles: handles, description }, context: context() });
  it("retries each recipient once, preserving original snapshots and group", async () => {
    const first = await submit();
    const second = await submit(["second-studio", "existing-studio"], "Edited after receipt");
    expect(first.projects.map((p) => p.id).sort()).toEqual(second.projects.map((p) => p.id).sort());
    expect(fake.rows.size).toBe(2);
    expect(fake.notified).toHaveBeenCalledTimes(2);
    expect(new Set([...fake.rows.values()].map((r) => r.request_group_id)).size).toBe(1);
    expect([...fake.rows.values()].every((r) => r.description === data.description)).toBe(true);
  });
  it("continues partial receipt without duplicating the first studio", async () => {
    fake.failHandle = "second-studio";
    await expect(submit()).rejects.toThrow("Temporary lookup failure");
    expect(fake.rows.size).toBe(1);
    fake.failHandle = null;
    await submit();
    expect(fake.rows.size).toBe(2);
    expect(fake.notified).toHaveBeenCalledTimes(2);
  });
  it("arbitrates simultaneous submissions through the request primary keys", async () => {
    await Promise.all([submit(), submit()]);
    expect(fake.rows.size).toBe(2);
    expect(fake.notified).toHaveBeenCalledTimes(2);
  });
  it("deduplicates case variants without changing the five-recipient limit", async () => {
    const result = await submit(["EXISTING-STUDIO", "existing-studio"]);
    expect(result.projects).toHaveLength(1);
    await expect(submit(["one", "two", "three", "four", "five", "six"])).rejects.toThrow();
  });
});
