/**
 * Runs `task` on every item with at most `limit` calls in flight, answering
 * the results in the order of the items. After one call fails, no further
 * item is started, and the first failure is what the answer rejects with.
 */
export async function mapWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  task: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];
  // One iterator shared by the workers: each item is handed out once.
  const pending = items.entries();
  let failed = false;

  const worker = async (): Promise<void> => {
    for (const [index, item] of pending) {
      if (failed) {
        return;
      }
      try {
        results[index] = await task(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}
