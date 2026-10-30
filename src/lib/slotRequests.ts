/** Verify that the conditional update actually claimed a row before reporting success. */
export async function requestOpenSlot(
  update: () => PromiseLike<{ data: { id: string }[] | null; error: unknown }>,
  refresh: () => Promise<void>,
): Promise<void> {
  const { data, error } = await update();
  if (error) throw error;
  if (!data?.length) {
    await refresh();
    throw new Error(
      "This time is no longer available or the request could not be confirmed. Please refresh and try another time.",
    );
  }
  await refresh();
}

/** Never release the existing appointment before the replacement request succeeds. */
export async function requestReplacement(
  claim: () => Promise<void>,
  releasePrevious?: () => Promise<void>,
): Promise<{ previousReleased: boolean }> {
  await claim();
  if (!releasePrevious) return { previousReleased: true };
  try {
    await releasePrevious();
    return { previousReleased: true };
  } catch {
    return { previousReleased: false };
  }
}
