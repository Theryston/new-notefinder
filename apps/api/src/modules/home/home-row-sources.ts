import type { HomeRowTitle, HomeTrack } from '@notefinder/contracts';
import { HomeRepository, type HomeTrackRecord } from './home.repository.js';
import type { ComposableTrack } from './home-feed-composer.js';
import type { HomeLayout } from './home-rules.js';

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
  load: () => Promise<HomeCandidate[]>;
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

/**
 * The feed's rows, in order: the hero, then trending today and newly added
 * Tracks. The hero is the hottest Track with a cover, so it draws from the
 * same trending list as its row.
 */
export const createHomeRowSources = (
  repository: HomeRepository,
): HomeRowSource[] => {
  const trending = async () =>
    (await repository.findTrendingTracks(CANDIDATE_LIMIT)).map(toHomeCandidate);
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
