import { accuracyBand } from '@notefinder/contracts';

/**
 * The personal blend of the home feed. The public popularity is the base and
 * a personal component is blended in: `final = (1 - λ) · popularity + λ ·
 * personal`. λ grows with the User's amount of data: no data means the public
 * feed. The personal component starts with taste from the genres and artists
 * of the User's Attempts and favorites. Pure: the builder loads the signals
 * and maps the rows it gets back.
 */

/**
 * How many taste signals (Attempts and favorites) earn the full personal
 * weight: λ reaches 1 here and grows linearly below it.
 */
export const PERSONAL_LAMBDA_SATURATION_SIGNALS = 50;

/** What a Track's genres weigh in its personal score. */
export const PERSONAL_GENRE_WEIGHT = 1;

/** What a Track's artist weighs in its personal score. */
export const PERSONAL_ARTIST_WEIGHT = 2;

/**
 * The personal weight of a User with this many taste signals: 0 without data
 * (the feed stays the public one), 1 from the saturation on.
 */
export const personalLambda = (signalCount: number): number =>
  Math.min(1, Math.max(0, signalCount) / PERSONAL_LAMBDA_SATURATION_SIGNALS);

/**
 * A Track's share of the User's taste for its genres: the average, over its
 * genres, of each genre's share of all genre signals. Unknown genres and an
 * empty taste read as 0, so a Track without a match never outranks one with.
 */
export const genreAffinity = (
  genres: readonly string[],
  genreSignals: ReadonlyMap<string, number>,
  totalGenreSignals: number,
): number => {
  if (genres.length === 0 || totalGenreSignals <= 0) {
    return 0;
  }
  const share = genres.reduce(
    (sum, genre) => sum + (genreSignals.get(genre) ?? 0),
    0,
  );
  return share / genres.length / totalGenreSignals;
};

/**
 * A Track's share of the User's taste for its artist: the artist's share of
 * all artist signals. An unknown artist and an empty taste read as 0.
 */
export const artistAffinity = (
  artistKey: string,
  artistSignals: ReadonlyMap<string, number>,
  totalArtistSignals: number,
): number =>
  totalArtistSignals <= 0
    ? 0
    : (artistSignals.get(artistKey) ?? 0) / totalArtistSignals;

/**
 * A Track's personal score from its taste affinities, between 0 and 1 like
 * the normalized popularity it blends with.
 */
export const personalScore = (
  genres: readonly string[],
  artistKey: string,
  taste: PersonalTaste,
): number =>
  (PERSONAL_GENRE_WEIGHT *
    genreAffinity(genres, taste.genreSignals, taste.totalGenreSignals) +
    PERSONAL_ARTIST_WEIGHT *
      artistAffinity(
        artistKey,
        taste.artistSignals,
        taste.totalArtistSignals,
      )) /
  (PERSONAL_GENRE_WEIGHT + PERSONAL_ARTIST_WEIGHT);

/** The User's taste: signal counts per genre and artist, with their totals. */
export type PersonalTaste = {
  genreSignals: ReadonlyMap<string, number>;
  totalGenreSignals: number;
  artistSignals: ReadonlyMap<string, number>;
  totalArtistSignals: number;
};

/** The blend of one Track's popularity with its personal score. */
export const blendScore = (
  popularity: number,
  personal: number,
  lambda: number,
): number => (1 - lambda) * popularity + lambda * personal;

/**
 * Whether the User mastered the Track: their best accuracy reached the hit
 * band, the same 85% the Profile's accuracy bands use. Mastered Tracks have
 * their own "sing again" row, so they stay out of the discovery rows.
 */
export const isMasteredTrack = (bestAccuracy: number): boolean =>
  accuracyBand(bestAccuracy) === 'hit';

/**
 * Whether a snapshot built at `generatedAt` is older than the staleness
 * limit: still served, but its rebuild is queued.
 */
export const personalSnapshotStale = (
  generatedAt: string,
  staleAfterSeconds: number,
  now = Date.now(),
): boolean => now - Date.parse(generatedAt) > staleAfterSeconds * 1000;
