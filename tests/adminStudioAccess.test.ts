import { describe, it, expect, vi } from "vitest";
const calls = vi.hoisted(() => ({ middleware: vi.fn(), createUser: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator = (input: unknown) => input;
    const chain = {
      middleware: (items: unknown[]) => { calls.middleware(items); return chain; },
      inputValidator: (fn: typeof validator) => { validator = fn; return chain; },
      handler: (fn: (input: unknown) => unknown) => (input: { data: unknown; context: unknown }) => fn({ ...input, data: validator(input.data) }),
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: { authenticated: true } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { auth: { admin: { createUser: calls.createUser } } } }));
import { createApprovedStudio, verifyAdminSignupCode } from "../src/lib/adminSignup.functions";

describe("legacy admin studio creation", () => {
  it("requires authentication middleware for both code and creation handlers", () => {
    expect(calls.middleware).toHaveBeenCalledTimes(2);
    expect(calls.middleware).toHaveBeenCalledWith([{ authenticated: true }]);
  });
  it("rejects non-admins before code validation or privileged creation", async () => {
    const context = { userId: "regular-account", supabase: { rpc: async () => ({ data: false, error: null }) } };
    const code = verifyAdminSignupCode as unknown as (input: unknown) => Promise<unknown>;
    const create = createApprovedStudio as unknown as (input: unknown) => Promise<unknown>;
    await expect(code({ context, data: { code: "any-supplied-code" } })).rejects.toThrow("administrator");
    await expect(create({ context, data: { code: "any-supplied-code", studioName: "Test studio", email: "test@example.test", password: "test-password" } })).rejects.toThrow("administrator");
    expect(calls.createUser).not.toHaveBeenCalled();
  });
});
