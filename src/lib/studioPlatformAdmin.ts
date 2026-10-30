type RoleClient = {
  rpc: (
    name: "has_role",
    args: { _user_id: string; _role: "admin" },
  ) => PromiseLike<{ data: boolean | null; error: unknown }>;
};

/** Shared access codes never substitute for the platform administrator role. */
export async function requireStudioPlatformAdmin(client: RoleClient, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("A platform administrator account is required.");
}
