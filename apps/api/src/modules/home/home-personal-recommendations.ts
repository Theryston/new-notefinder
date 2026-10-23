import {
  EXPLORATION_SLOT_SHARE,
  PERSONAL_GENRE_LIMIT,
  type PersonalTaste,
  personalScore,
  TASTE_SIGNAL_HALF_LIFE_DAYS,
} from './home-personal.js';

export type TasteSignal = {
  genres: string[];
  artistKey: string;
  weight: number;
  lastSignalAt: Date;
};

export type ArtistTasteSignal = {
  artistId: string;
  name: string;
  attempts: number;
  lastAttemptAt: Date;
};

/** Recent activity keeps its weight; older activity falls off exponentially. */
export const decaySignal = (
  weight: number,
  lastSignalAt: Date,
  now = Date.now(),
): number => {
  const age = Math.max(0, now - lastSignalAt.getTime());
  const halfLifeMs = TASTE_SIGNAL_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, weight) * 2 ** (-age / halfLifeMs);
};

/** Builds normalized taste inputs from weighted, time-decayed practice. */
export const decayedTaste = (
  signals: readonly TasteSignal[],
  now = Date.now(),
): PersonalTaste => {
  const genreSignals = new Map<string, number>();
  const artistSignals = new Map<string, number>();
  for (const signal of signals) {
    const weight = decaySignal(signal.weight, signal.lastSignalAt, now);
    for (const genre of signal.genres) {
      genreSignals.set(genre, (genreSignals.get(genre) ?? 0) + weight);
    }
    artistSignals.set(
      signal.artistKey,
      (artistSignals.get(signal.artistKey) ?? 0) + weight,
    );
  }
  return {
    genreSignals,
    totalGenreSignals: total(genreSignals),
    artistSignals,
    totalArtistSignals: total(artistSignals),
  };
};

/** One decayed unit per attempt or favorite, independent of tag count. */
export const decayedSignalCount = (
  signals: readonly TasteSignal[],
  now = Date.now(),
): number =>
  signals.reduce(
    (sum, signal) => sum + decaySignal(signal.weight, signal.lastSignalAt, now),
    0,
  );

const total = (signals: ReadonlyMap<string, number>): number =>
  [...signals.values()].reduce((sum, value) => sum + value, 0);

/** Top genres in signal order, with stable alphabetical ties. */
export const topGenres = (taste: PersonalTaste): string[] =>
  [...taste.genreSignals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, PERSONAL_GENRE_LIMIT)
    .map(([genre]) => genre);

/** The most-sung Artists reordered by their decayed attempt signals. */
export const rankTasteArtists = (
  artists: readonly ArtistTasteSignal[],
  now = Date.now(),
): ArtistTasteSignal[] => {
  const totals = new Map<string, ArtistTasteSignal>();
  for (const activity of artists) {
    const previous = totals.get(activity.artistId);
    const weight = decaySignal(activity.attempts, activity.lastAttemptAt, now);
    totals.set(activity.artistId, {
      ...activity,
      attempts: (previous?.attempts ?? 0) + weight,
      lastAttemptAt:
        previous && previous.lastAttemptAt > activity.lastAttemptAt
          ? previous.lastAttemptAt
          : activity.lastAttemptAt,
    });
  }
  return [...totals.values()].sort(
    (a, b) =>
      b.attempts - a.attempts ||
      b.lastAttemptAt.getTime() - a.lastAttemptAt.getTime() ||
      a.artistId.localeCompare(b.artistId),
  );
};

/** An exploration slot is one fifth of the visible discovery positions. */
export const explorationSlotCount = (trackSlots: number): number =>
  Math.floor(Math.max(0, trackSlots) * EXPLORATION_SLOT_SHARE);

/** Taste score for whether a Track matches any learned genre or artist. */
export const tasteMatch = (
  genres: readonly string[],
  artistKey: string,
  taste: PersonalTaste,
): number => personalScore(genres, artistKey, taste);
