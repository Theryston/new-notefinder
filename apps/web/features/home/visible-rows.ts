import type { HomeRow } from '@notefinder/contracts';

/** Keeps the first occurrence of each row id, so React keys stay unique. */
export function uniqueRows(rows: readonly HomeRow[]): HomeRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * The rows to show, in feed order: unique, and only those of a layout the web
 * renders. Filtering comes first, so the first visible row is the first one
 * whose images may load eagerly.
 */
export function visibleRows(
  rows: readonly HomeRow[],
  isKnownLayout: (layout: HomeRow['layout']) => boolean,
): HomeRow[] {
  return uniqueRows(rows).filter((row) => isKnownLayout(row.layout));
}
