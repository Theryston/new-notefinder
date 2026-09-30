/**
 * Puts `rows` in the order of `ids`. The search engine decides the order of a
 * search (its relevance order) and Postgres only holds what to show, so the
 * rows are reordered to follow the ids, not sorted by any rule of ours. An id
 * without a row (a Recording that has since left the database) is dropped.
 */
export const orderByIds = <TRow>(
  ids: readonly string[],
  rows: readonly TRow[],
  idOf: (row: TRow) => string,
): TRow[] => {
  const byId = new Map(rows.map((row) => [idOf(row), row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [row];
  });
};
