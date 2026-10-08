// The release a Track's cover is taken from (pure). The Music catalog lists
// the release of a Recording it shows first (the earliest by date, undated
// last, then by title and MBID). A Track keeps only the year of each release,
// so the same rule runs on years: within one year the choice can differ from
// the catalog's, which only affects which edition's front cover is used.

export type ReleaseOfTrack = {
  mbid: string;
  title: string;
  year: number | null;
};

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

const compareYears = (a: number | null, b: number | null): number => {
  if (a === null || b === null) {
    return a === b ? 0 : a === null ? 1 : -1;
  }
  return a - b;
};

/** The release listed first: earliest year, then title, then MBID. */
export function primaryReleaseOf<T extends ReleaseOfTrack>(
  releases: readonly T[],
): T | undefined {
  return [...releases].sort(
    (a, b) =>
      compareYears(a.year, b.year) ||
      compareText(a.title, b.title) ||
      compareText(a.mbid, b.mbid),
  )[0];
}
