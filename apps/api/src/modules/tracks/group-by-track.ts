export type ByTrack<TRow> = Map<string, Omit<TRow, 'trackId'>[]>;

export function groupByTrack<T extends { trackId: string }>(
  rows: T[],
): ByTrack<T> {
  const byTrack: ByTrack<T> = new Map();
  for (const row of rows) {
    const { trackId, ...rest } = row;
    const list = byTrack.get(trackId) ?? [];
    list.push(rest);
    byTrack.set(trackId, list);
  }
  return byTrack;
}
