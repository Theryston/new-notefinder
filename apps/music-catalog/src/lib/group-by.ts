/** Collects the items under the key they map to, each group in input order. */
export const groupBy = <TItem, TKey>(
  items: readonly TItem[],
  keyOf: (item: TItem) => TKey,
): Map<TKey, TItem[]> => {
  const groups = new Map<TKey, TItem[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [item]);
    } else {
      group.push(item);
    }
  }
  return groups;
};
