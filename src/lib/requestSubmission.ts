/** Reuse the request UUID on retry. The database primary key arbitrates racing submissions. */
export async function insertRequestOnce<
  T extends { id: string; client_user_id: string | null; artist_id: string },
>(
  key: string,
  customerId: string,
  studioId: string,
  read: () => Promise<T | null>,
  insert: () => Promise<{ row: T | null; error: { code?: string; message?: string } | null }>,
): Promise<{ row: T; created: boolean }> {
  const verify = (row: T) => {
    if (row.id !== key || row.client_user_id !== customerId || row.artist_id !== studioId)
      throw new Error("This request key belongs to a different request.");
    return row;
  };
  const existing = await read();
  if (existing) return { row: verify(existing), created: false };
  const result = await insert();
  if (!result.error && result.row) return { row: verify(result.row), created: true };
  if (result.error?.code === "23505") {
    const winner = await read();
    if (winner) return { row: verify(winner), created: false };
  }
  throw new Error(result.error?.message || "Could not create request.");
}

export function validRequestFiles(files: readonly Pick<File, "size" | "type">[]) {
  return (
    files.length <= 8 &&
    files.every(
      (file) =>
        file.size > 0 &&
        file.size <= 15 * 1024 * 1024 &&
        (file.type.startsWith("image/") || file.type === "application/pdf"),
    )
  );
}
