import type { MostSungArtist } from '@notefinder/contracts';

export type ArtistGroup = {
  artist: MostSungArtist;
  bleedSuspected: boolean;
  attempts: number;
  lastAttemptAt: Date;
};

/** The valid-attempt tally and recency used to order most-sung Artists. */
export type MostSungArtistSignal = {
  artist: MostSungArtist;
  attempts: number;
  lastAttemptAt: Date;
};

/** Most valid runs first, then latest run, then stable Artist id. */
export const rankMostSungArtists = (
  groups: readonly ArtistGroup[],
): MostSungArtistSignal[] => {
  const tallies = new Map<string, MostSungArtistSignal>();
  for (const group of groups) {
    if (group.bleedSuspected) {
      continue;
    }
    const previous = tallies.get(group.artist.id);
    const latest = group.lastAttemptAt.getTime();
    tallies.set(group.artist.id, {
      artist: group.artist,
      attempts: (previous?.attempts ?? 0) + group.attempts,
      lastAttemptAt: new Date(
        Math.max(previous?.lastAttemptAt.getTime() ?? 0, latest),
      ),
    });
  }
  return [...tallies.values()].sort(
    (a, b) =>
      b.attempts - a.attempts ||
      b.lastAttemptAt.getTime() - a.lastAttemptAt.getTime() ||
      a.artist.id.localeCompare(b.artist.id),
  );
};
