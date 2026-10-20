import type { HomeRowTitle, HomeTrack, Locale } from '@notefinder/contracts';
import { TrackLocaleTrendingService } from '../tracks/track-locale-trending.service.js';
import { HomeRepository, type HomeTrackRecord } from './home.repository.js';
import type { ComposableTrack } from './home-feed-composer.js';
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

const toHomeCandidate = (record: HomeTrackRecord): HomeCandidate => {
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
  };
};

const title = (key: string): HomeRowTitle => ({ key, params: {} });

/** The repository reads the row sources need; narrowed so tests can fake them. */
type HomeRecords = Pick<
  HomeRepository,
  'findTrendingTracks' | 'findNewestTracks' | 'findCompletedTracksByIds'
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

/**
 * The feed's rows, in order: the hero, then trending today and newly added
 * Tracks. The hero is the hottest Track with a cover, so it draws from the
 * same trending list as its row.
 */
export const createHomeRowSources = (
  repository: HomeRecords,
  ranking: TrendingRanking,
): HomeRowSource[] => {
  const trending = async (locale: Locale = DEFAULT_HOME_LOCALE) =>
    (await localeTrending(repository, ranking, locale)).map(toHomeCandidate);
  const newest = async () =>
    (await repository.findNewestTracks(CANDIDATE_LIMIT)).map(toHomeCandidate);
  return [
    { id: 'hero', layout: 'hero', load: trending },
    {
      id: 'trending-today',
      layout: 'standard',
      title: title('home.rows.trendingToday'),
      load: trending,
    },
    {
      id: 'new-tracks',
      layout: 'standard',
      title: title('home.rows.newTracks'),
      load: newest,
    },
  ];
};
