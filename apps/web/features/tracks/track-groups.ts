export type TrackGroup<TItem> = {
  /** Shown above the group's first item; `null` for a group with no heading. */
  heading: string | null;
  items: TItem[];
};

/**
 * Splits the loaded items into runs of consecutive items that share a
 * heading. The items are every loaded page concatenated, so a page that
 * continues the last group extends that group: its heading is never
 * repeated across page boundaries. Headings only show when the items span
 * more than one group; a single group (or no `groupBy`) comes back without
 * a heading, which is the plain grid.
 */
export function groupTracksByHeading<TItem>(
  items: readonly TItem[],
  groupBy?: (item: TItem) => string | null,
): TrackGroup<TItem>[] {
  const runs = toRuns(items, groupBy);
  if (runs.length > 1) return runs;
  return runs.map((run) => ({ heading: null, items: run.items }));
}

function toRuns<TItem>(
  items: readonly TItem[],
  groupBy: ((item: TItem) => string | null) | undefined,
): TrackGroup<TItem>[] {
  const runs: TrackGroup<TItem>[] = [];
  for (const item of items) {
    const heading = groupBy?.(item) ?? null;
    const last = runs.at(-1);
    if (last && last.heading === heading) {
      last.items.push(item);
    } else {
      runs.push({ heading, items: [item] });
    }
  }
  return runs;
}
