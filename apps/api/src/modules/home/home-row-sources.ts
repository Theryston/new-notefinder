import type { HomeRowTitle, HomeTrack, Locale } from '@notefinder/contracts';
import { TrackLocaleTrendingService } from '../tracks/track-locale-trending.service.js';
import { HomeRepository, type HomeTrackRecord } from './home.repository.js';
import type { ComposableTrack } from './home-feed-composer.js';
import {
  popularityScore,
  rankBySignalCount,
  SINGING_SIGNAL_WINDOW_DAYS,
  TOP_10_WINDOW_DAYS,
} from './home-popularity.js';
import { DEFAULT_HOME_LOCALE, type HomeLayout } from './home-rules.js';

/** Injection token of the row sources the builder composes, in feed order. */
export const HOME_ROW_SOURCES = Symbol('HOME_ROW_SOURCES');

/** How many candidates a source offers the composer, best first. */
const CANDIDATE_LIMIT = 60;

/** The artist credit with the MBID the artist cap can count by. */
type HomeCandidateCredit = {
  name: string;
  joinPhrase: string;
  mbid?: string;
};

/** A Track as the composer places it, with what its card shows. */
export type HomeCandidate = ComposableTrack &
  Omit<HomeTrack, 'artistCredit'> & { artistCredit: HomeCandidateCredit[] };

/** A candidate row: where its Tracks come from and how the row is titled. */
export type HomeRowSource = {
  id: string;
  layout: HomeLayout;
  /** Standard rows show it; a hero has no title. */
  title?: HomeRowTitle;
  /**
   * Loads the candidates of one feed locale, best first. Without a locale, the
   * default one.
   */
  load: (locale?: Locale) => Promise<HomeCandidate[]>;
};

export const toHomeCandidate = (record: HomeTrackRecord): HomeCandidate => {
  const [primary] = record.artistCredit;
  const { vocalRangeLowest, vocalRangeHighest } = record;
  return {
    id: record.id,
    title: record.title,
    coverUrl: record.coverUrl,
    artistCredit: record.artistCredit,
    durationMs: record.lengthMs,
    vocalRange:
      vocalRangeLowest === null || vocalRangeHighest === null
        ? null
        : { lowest: vocalRangeLowest, highest: vocalRangeHighest },
    artistKey: primary?.mbid ?? primary?.name ?? record.id,
    hasCover: record.coverUrl !== null,
    // The repository only reads Tracks whose Processing completed.
    isCompleted: true,
    // Absent means no stored Vocal range, from a Track without notes.
    hasVocalRange: vocalRangeLowest !== null && vocalRangeHighest !== null,
  };
};

const title = (key: string): HomeRowTitle => ({ key, params: {} });

/** The repository reads the row sources need; narrowed so tests can fake them. */
type HomeRecords = Pick<
  HomeRepository,
  | 'findTrendingTracks'
  | 'findNewestTracks'
  | 'findCompletedTracksByIds'
  | 'findMostSungTrackIds'
  | 'findMostFavoritedTrackIds'
  | 'countRecentAttempts'
  | 'countRecentFavorites'
>;
type TrendingRecords = Pick<
  HomeRepository,
  'findTrendingTracks' | 'findCompletedTracksByIds'
>;
type TrendingRanking = Pick<TrackLocaleTrendingService, 'rank'>;

/**
 * Orders the records as the ranked `ids` name them; an id with no record (a
 * Track that is no longer completed) is skipped.
 */
export const inRankOrder = (
  records: HomeTrackRecord[],
  ids: readonly string[],
): HomeTrackRecord[] => {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => {
    const record = byId.get(id);
    return record ? [record] : [];
  });
};

/**
 * The trending candidates of one locale. A locale with enough views this month
 * is ranked by its own views; otherwise the global trending score applies.
 */
const localeTrending = async (
  repository: TrendingRecords,
  ranking: TrendingRanking,
  locale: Locale,
): Promise<HomeTrackRecord[]> => {
  const entries = await ranking.rank(locale);
  if (entries === undefined) {
    return repository.findTrendingTracks(CANDIDATE_LIMIT);
  }
  const ids = entries.slice(0, CANDIDATE_LIMIT).map((entry) => entry.trackId);
  return inRankOrder(await repository.findCompletedTracksByIds(ids), ids);
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The start of the rolling window `days` long that ends now. */
const windowSince = (days: number, now: number = Date.now()): Date =>
  new Date(now - days * DAY_MS);

/**
 * The completed Tracks behind a signal count (valid Attempts, recent
 * favorites), best first. The repository reads them in signal order already;
 * `inRankOrder` keeps that order and skips Tracks that stopped being completed.
 */
const rankedBySignal = async (
  repository: Pick<HomeRepository, 'findCompletedTracksByIds'>,
  count: () => Promise<{ trackId: string; count: number }[]>,
): Promise<HomeTrackRecord[]> => {
  const ids = rankBySignalCount(await count()).map((entry) => entry.trackId);
  return inRankOrder(await repository.findCompletedTracksByIds(ids), ids);
};

/** The weekly Top 10: the blended popularity of the week, best first. */
const weeklyTop10 = async (
  repository: HomeRecords,
  ranking: TrendingRanking,
  locale: Locale,
): Promise<HomeTrackRecord[]> => {
  const since = windowSince(TOP_10_WINDOW_DAYS);
  const trendingIds = (await localeTrending(repository, ranking, locale)).map(
    (record) => record.id,
  );
  const [sung, favorited] = await Promise.all([
    repository.findMostSungTrackIds(CANDIDATE_LIMIT, since),
    repository.findMostFavoritedTrackIds(CANDIDATE_LIMIT, since),
  ]);
  const pool = [
    ...new Set([
      ...trendingIds,
      ...sung.map((entry) => entry.trackId),
      ...favorited.map((entry) => entry.trackId),
    ]),
  ];
  const records = await repository.findCompletedTracksByIds(pool);
  const [attempts, favorites] = await Promise.all([
    repository.countRecentAttempts(pool, since),
    repository.countRecentFavorites(pool, since),
  ]);
  const attemptsOf = new Map(
    attempts.map((entry) => [entry.trackId, entry.count]),
  );
  const favoritesOf = new Map(
    favorites.map((entry) => [entry.trackId, entry.count]),
  );
  const scored = records
    .map((record) => {
      const attempts = attemptsOf.get(record.id) ?? 0;
      const favorites = favoritesOf.get(record.id) ?? 0;
      return {
        id: record.id,
        // The chart only ranks Tracks the community sang or favorited this
        // week: without a signal it would relabel the trending leftovers with
        // the wrong numbers.
        signal: attempts + favorites,
        score: popularityScore({
          trendingScore: record.trendingScore ?? 0,
          attempts,
          favorites,
        }),
      };
    })
    .filter((entry) => entry.signal > 0 && entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // No slice here: the composer keeps the first unused Tracks up to the
  // layout's own maximum, so earlier rows never starve the chart.
  return inRankOrder(
    records,
    scored.map((entry) => entry.id),
  );
};

/**
 * The feed's rows, in order: the hero, popularity (trending today, the weekly
 * Top 10, most sung, most favorited) and newly added Tracks. The hero is the
 * hottest Track with a cover, so it draws from the same trending list as its
 * row.
 */
export const createHomeRowSources = (
  repository: HomeRecords,
  ranking: TrendingRanking,
): HomeRowSource[] => {
  const trending = async (locale: Locale = DEFAULT_HOME_LOCALE) =>
    (await localeTrending(repository, ranking, locale)).map(toHomeCandidate);
  const newest = async () =>
    (await repository.findNewestTracks(CANDIDATE_LIMIT)).map(toHomeCandidate);
  const mostSung = async () =>
    (
      await rankedBySignal(repository, () =>
        repository.findMostSungTrackIds(
          CANDIDATE_LIMIT,
          windowSince(SINGING_SIGNAL_WINDOW_DAYS),
        ),
      )
    ).map(toHomeCandidate);
  const mostFavorited = async () =>
    (
      await rankedBySignal(repository, () =>
        repository.findMostFavoritedTrackIds(
          CANDIDATE_LIMIT,
          windowSince(SINGING_SIGNAL_WINDOW_DAYS),
        ),
      )
    ).map(toHomeCandidate);
  const top10 = async (locale: Locale = DEFAULT_HOME_LOCALE) =>
    (await weeklyTop10(repository, ranking, locale)).map(toHomeCandidate);
  return [
    { id: 'hero', layout: 'hero', load: trending },
    {
      id: 'trending-today',
      layout: 'standard',
      title: title('home.rows.trendingToday'),
      load: trending,
    },
    {
      id: 'most-sung',
      layout: 'standard',
      title: title('home.rows.mostSung'),
      load: mostSung,
    },
    {
      id: 'most-favorited',
      layout: 'standard',
      title: title('home.rows.mostFavorited'),
      load: mostFavorited,
    },
    {
      id: 'top-10-week',
      layout: 'ranked',
      title: title('home.rows.top10Week'),
      load: top10,
    },
    {
      id: 'new-tracks',
      layout: 'standard',
      title: title('home.rows.newTracks'),
      load: newest,
    },
  ];
};
