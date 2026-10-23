import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  HomeArtist,
  HomeArtistsRow,
  HomeRow,
  HomeRowTitle,
  HomeTrack,
} from '@notefinder/contracts';
import { AttemptsService } from '../attempts/attempts.service.js';
import type { MostSungArtistSignal } from '../attempts/profile-chips-ranking.js';
import { composeHomeRows } from './home-feed-composer.js';
import type { PersonalTaste } from './home-personal.js';
import {
  PersonalHomeRepository,
  type PersonalTrackCandidate,
  type UserTrackSignal,
} from './home-personal.repository.js';
import {
  decayedSignalCount,
  explorationSlotCount,
  rankTasteArtists,
  type TasteSignal,
  tasteMatch,
  topGenres,
} from './home-personal-recommendations.js';
import { HOME_ROW_RULES } from './home-rules.js';

const MIN_TASTE_SIGNALS = 3;
const CO_OCCURRENCE_SOURCE_LIMIT = 12;
const PERSONAL_CANDIDATE_LIMIT = 60;

const title = (key: string): HomeRowTitle => ({ key, params: {} });

const trackIdsOfRow = (row: HomeRow): string[] => {
  if (row.layout === 'hero') return [row.track.id];
  if (
    row.layout === 'standard' ||
    row.layout === 'vocal-range' ||
    row.layout === 'ranked'
  ) {
    return row.items.map((track) => track.id);
  }
  return [];
};

const artistKeyOf = (track: PersonalTrackCandidate): string =>
  track.artistCredit[0]?.mbid ?? track.artistCredit[0]?.name ?? track.id;

const homeTrackOf = (track: PersonalTrackCandidate): HomeTrack => ({
  id: track.id,
  title: track.title,
  coverUrl: track.coverUrl,
  artistCredit: track.artistCredit.map((credit) => ({
    name: credit.name,
    joinPhrase: credit.joinPhrase,
    artistId: null,
  })),
  durationMs: track.durationMs,
  vocalRange:
    track.vocalRangeLowest === null || track.vocalRangeHighest === null
      ? null
      : { lowest: track.vocalRangeLowest, highest: track.vocalRangeHighest },
});

@Injectable()
export class PersonalHomeTasteRowsService {
  @Optional()
  @Inject(AttemptsService)
  private readonly attempts?: AttemptsService;

  constructor(private readonly personal: PersonalHomeRepository) {}

  async build(options: {
    userId: string;
    signals: UserTrackSignal[];
    tasteSignals: TasteSignal[];
    taste: PersonalTaste;
    mastered: ReadonlySet<string>;
    usedTrackIds: Set<string>;
    publicRows: HomeRow[];
  }): Promise<HomeRow[]> {
    if (decayedSignalCount(options.tasteSignals) < MIN_TASTE_SIGNALS) {
      return [];
    }
    const [cooccurrence, genres, artists] = await Promise.all([
      this.becauseYouSangRow(options),
      this.genreTasteRow(options),
      this.mostSungArtistsRow(options.userId),
    ]);
    const rows = [cooccurrence, genres, artists].flatMap((row) =>
      row ? [row] : [],
    );
    for (const row of rows) {
      for (const id of trackIdsOfRow(row)) options.usedTrackIds.add(id);
    }
    return rows;
  }

  async explorationRow(options: {
    taste: PersonalTaste;
    tasteSignals: TasteSignal[];
    mastered: ReadonlySet<string>;
    usedTrackIds: ReadonlySet<string>;
    visibleTrackSlots: number;
  }): Promise<HomeRow | undefined> {
    if (decayedSignalCount(options.tasteSignals) < MIN_TASTE_SIGNALS) {
      return undefined;
    }
    return this.buildExplorationRow(options);
  }

  private async becauseYouSangRow(options: {
    userId: string;
    signals: UserTrackSignal[];
    mastered: ReadonlySet<string>;
    usedTrackIds: ReadonlySet<string>;
  }): Promise<HomeRow | undefined> {
    const sources = await this.personal.findUserSungTrackSources(
      options.userId,
      CO_OCCURRENCE_SOURCE_LIMIT,
    );
    const pairs = await this.personal.findCommunityCooccurrence(
      sources.map((source) => source.trackId),
    );
    const grouped = new Map<string, typeof pairs>();
    for (const pair of pairs) {
      const current = grouped.get(pair.sourceTrackId) ?? [];
      current.push(pair);
      grouped.set(pair.sourceTrackId, current);
    }
    const source = sources.find((candidate) => grouped.has(candidate.trackId));
    const signal = options.signals.find(
      (candidate) => candidate.trackId === source?.trackId,
    );
    if (!source || !signal) return undefined;
    const rankedIds = (grouped.get(source.trackId) ?? [])
      .sort(
        (a, b) =>
          b.singers - a.singers ||
          a.targetTrackId.localeCompare(b.targetTrackId),
      )
      .map((pair) => pair.targetTrackId);
    const cards = await this.personal.findCommunityTrackCards(rankedIds);
    return this.composeTasteTrackRow({
      id: 'because-you-sang',
      title: {
        key: 'home.rows.becauseYouSang',
        params: { trackTitle: signal.title },
      },
      cards,
      mastered: options.mastered,
      used: options.usedTrackIds,
    });
  }

  private async genreTasteRow(options: {
    taste: PersonalTaste;
    mastered: ReadonlySet<string>;
    usedTrackIds: ReadonlySet<string>;
  }): Promise<HomeRow | undefined> {
    const genres = topGenres(options.taste);
    const cards = await this.personal.findTracksForGenres(
      genres,
      PERSONAL_CANDIDATE_LIMIT,
    );
    return this.composeTasteTrackRow({
      id: 'more-of-your-genres',
      title: title('home.rows.moreOfYourGenres'),
      cards: cards.sort(
        (a, b) =>
          tasteMatch(b.genres, artistKeyOf(b), options.taste) -
            tasteMatch(a.genres, artistKeyOf(a), options.taste) ||
          b.trendingScore - a.trendingScore ||
          a.id.localeCompare(b.id),
      ),
      taste: options.taste,
      mastered: options.mastered,
      used: options.usedTrackIds,
    });
  }

  private async mostSungArtistsRow(
    userId: string,
  ): Promise<HomeRow | undefined> {
    const signals: MostSungArtistSignal[] = this.attempts
      ? await this.attempts.mostSungArtists(userId)
      : [];
    const artists = rankTasteArtists(
      signals.map((signal) => ({
        artistId: signal.artist.id,
        name: signal.artist.name,
        attempts: signal.attempts,
        lastAttemptAt: signal.lastAttemptAt,
      })),
    ).slice(0, HOME_ROW_RULES.artists.maxItems);
    if (artists.length < HOME_ROW_RULES.artists.minItems) return undefined;
    return {
      id: 'your-most-sung-artists',
      layout: 'artists',
      title: title('home.rows.yourMostSungArtists'),
      items: artists.map(
        (artist): HomeArtist => ({
          id: artist.artistId,
          name: artist.name,
        }),
      ),
    } satisfies HomeArtistsRow;
  }

  private async buildExplorationRow(options: {
    taste: PersonalTaste;
    mastered: ReadonlySet<string>;
    usedTrackIds: ReadonlySet<string>;
    visibleTrackSlots: number;
  }): Promise<HomeRow | undefined> {
    const slots = Math.min(
      HOME_ROW_RULES.standard.maxItems,
      explorationSlotCount(options.visibleTrackSlots),
    );
    if (slots < HOME_ROW_RULES.standard.minItems) return undefined;
    const candidates = await this.personal.findTracksOutsideGenres(
      topGenres(options.taste),
      PERSONAL_CANDIDATE_LIMIT,
    );
    const unfamiliar = candidates
      .filter(
        (candidate) =>
          tasteMatch(
            candidate.genres,
            artistKeyOf(candidate),
            options.taste,
          ) === 0 &&
          !options.mastered.has(candidate.id) &&
          !options.usedTrackIds.has(candidate.id),
      )
      .slice(0, slots);
    const row = this.composeTasteTrackRow({
      id: 'explore',
      title: title('home.rows.explore'),
      cards: unfamiliar,
      mastered: options.mastered,
      used: options.usedTrackIds,
    });
    return row;
  }

  private composeTasteTrackRow(options: {
    id: string;
    title: HomeRowTitle;
    cards: PersonalTrackCandidate[];
    taste?: PersonalTaste;
    mastered: ReadonlySet<string>;
    used: ReadonlySet<string>;
  }): HomeRow | undefined {
    const candidates = options.cards
      .filter(
        (card) => !options.mastered.has(card.id) && !options.used.has(card.id),
      )
      .map((card) => ({
        id: card.id,
        artistKey: artistKeyOf(card),
        hasCover: card.coverUrl !== null,
        isCompleted: true,
        track: homeTrackOf(card),
        score: options.taste
          ? tasteMatch(card.genres, artistKeyOf(card), options.taste)
          : 0,
      }));
    const [composed] = composeHomeRows([
      {
        id: options.id,
        layout: 'standard' as const,
        title: options.title,
        items: candidates.sort((a, b) => b.score - a.score),
      },
    ]);
    return composed
      ? {
          id: composed.id,
          layout: 'standard',
          title: composed.title ?? options.title,
          items: composed.items.map((card) => card.track),
        }
      : undefined;
  }
}
