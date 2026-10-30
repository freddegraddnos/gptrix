/** Legacy username accounts used a private, non-deliverable sign-in address. */
export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const usernameToEmail = (u: string) => `${normalizeUsername(u)}@users.inksimulator.com`;
export const isValidUsername = (u: string) => /^[a-z0-9_]{3,20}$/.test(normalizeUsername(u));
