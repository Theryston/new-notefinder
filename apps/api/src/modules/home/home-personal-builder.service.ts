import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  HomeCarouselRow,
  HomeRow,
  HomeTrack,
  Locale,
} from '@notefinder/contracts';
import { StreaksService } from '../streaks/streaks.service.js';
import { UsersService } from '../users/users.service.js';
import type { StoredPersonalHomeFeed } from './home-feed.js';
import { HomeFeedService } from './home-feed.service.js';
import { composeHomeRows } from './home-feed-composer.js';
import {
  isMasteredTrack,
  type PersonalTaste,
  personalLambda,
} from './home-personal.js';
import {
  PersonalHomeRepository,
  type UserTrackSignal,
} from './home-personal.repository.js';
import { PersonalHomeBuilderDataService } from './home-personal-builder-data.service.js';
import { PersonalHomePublicRowsService } from './home-personal-public-rows.service.js';
import {
  decayedSignalCount,
  decayedTaste,
  type TasteSignal,
} from './home-personal-recommendations.js';
import { DEFAULT_HOME_LOCALE, HOME_ALGORITHM_VERSION } from './home-rules.js';

const title = (key: string) => ({ key, params: {} });

const trackIdsOfRow = (row: HomeRow): string[] => {
  if (row.layout === 'hero') {
    return [row.track.id];
  }
  if (
    row.layout === 'standard' ||
    row.layout === 'vocal-range' ||
    row.layout === 'ranked'
  ) {
    return row.items.map((track) => track.id);
  }
  return [];
};

const toResumeCandidate = (signal: UserTrackSignal) => ({
  id: signal.trackId,
  artistKey: signal.artistKey,
  hasCover: signal.coverUrl !== null,
  isCompleted: true,
  track: {
    id: signal.trackId,
    title: signal.title,
    coverUrl: signal.coverUrl,
    artistCredit: signal.artistCredit,
    durationMs: signal.durationMs,
    vocalRange:
      signal.vocalRangeLowest === null || signal.vocalRangeHighest === null
        ? null
        : {
            lowest: signal.vocalRangeLowest,
            highest: signal.vocalRangeHighest,
          },
  } satisfies HomeTrack,
});

const versionOf = (userId: string, locale: Locale, rows: HomeRow[]): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        audience: 'personal',
        algorithmVersion: HOME_ALGORITHM_VERSION,
        userId,
        locale,
        rows,
      }),
    )
    .digest('hex')
    .slice(0, 16);

/**
 * Builds one User's personal feed. The public feed is the base: its Tracks
 * are re-ranked by the blend of their normalized popularity with the User's
 * taste, mastered Tracks are filtered out of the discovery rows, and the
 * resume rows and the daily target strip lead. A User with no data gets the
 * public rows (λ = 0 keeps their order) plus the strip.
 */
@Injectable()
export class PersonalHomeBuilder {
  constructor(
    private readonly feeds: HomeFeedService,
    private readonly personal: PersonalHomeRepository,
    private readonly streaks: StreaksService,
    private readonly users: UsersService,
  ) {}

  @Optional()
  @Inject(PersonalHomeBuilderDataService)
  private readonly data?: PersonalHomeBuilderDataService;

  async build(
    userId: string,
    locale: Locale = DEFAULT_HOME_LOCALE,
  ): Promise<StoredPersonalHomeFeed> {
    const [{ feed }, signals, favorites, settings] = await Promise.all([
      this.feeds.currentPublic(locale),
      this.personal.findUserTrackSignals(userId),
      this.personal.findUserFavoriteSignals(userId),
      this.users.getPracticeSettings(userId),
    ]);
    const tasteSignals = this.tasteSignals(signals, favorites);
    const taste = decayedTaste(tasteSignals);
    const signalCount = decayedSignalCount(tasteSignals);
    const lambda = personalLambda(signalCount);
    const mastered = new Set(
      signals
        .filter((signal) => isMasteredTrack(signal.bestAccuracy))
        .map((signal) => signal.trackId),
    );
    const leadingRows: HomeRow[] = [
      ...this.resumeRows(signals, mastered),
      await this.dailyTargetRow(userId, settings.timeZone),
    ];
    const usedTrackIds = new Set(leadingRows.flatMap(trackIdsOfRow));
    const recommendationRows = await this.recommendationRows({
      userId,
      signals,
      tasteSignals,
      taste,
      lambda,
      mastered,
      usedTrackIds,
      leadingRows,
      publicRows: feed.rows,
    });
    const rows = [...leadingRows, ...recommendationRows];
    return this.linkArtistPages({
      audience: 'personal',
      locale,
      version: versionOf(userId, locale, rows),
      algorithmVersion: HOME_ALGORITHM_VERSION,
      rows,
      generatedAt: new Date().toISOString(),
    });
  }

  private async recommendationRows(options: {
    userId: string;
    signals: UserTrackSignal[];
    tasteSignals: TasteSignal[];
    taste: PersonalTaste;
    lambda: number;
    mastered: ReadonlySet<string>;
    usedTrackIds: Set<string>;
    leadingRows: HomeRow[];
    publicRows: HomeRow[];
  }): Promise<HomeRow[]> {
    if (!this.data) {
      const fallback = new PersonalHomePublicRowsService(this.personal);
      const blended = await fallback.blendPool(
        options.publicRows,
        options.taste,
        options.lambda,
        options.mastered,
      );
      return fallback.rows(
        options.publicRows,
        blended,
        options.mastered,
        options.usedTrackIds,
      );
    }
    const blended = await this.data.publicRows.blendPool(
      options.publicRows,
      options.taste,
      options.lambda,
      options.mastered,
    );
    const personalRows = await this.data.tasteRows.build({
      userId: options.userId,
      signals: options.signals,
      tasteSignals: options.tasteSignals,
      taste: options.taste,
      mastered: options.mastered,
      usedTrackIds: options.usedTrackIds,
      publicRows: options.publicRows,
    });
    const discoveryRows = this.data.publicRows.rows(
      options.publicRows,
      blended,
      options.mastered,
      options.usedTrackIds,
    );
    for (const row of discoveryRows) {
      for (const id of trackIdsOfRow(row)) options.usedTrackIds.add(id);
    }
    const explore = await this.data.tasteRows.explorationRow({
      taste: options.taste,
      tasteSignals: options.tasteSignals,
      mastered: options.mastered,
      usedTrackIds: options.usedTrackIds,
      visibleTrackSlots: [
        ...options.leadingRows,
        ...personalRows,
        ...discoveryRows,
      ].flatMap(trackIdsOfRow).length,
    });
    return [...personalRows, ...(explore ? [explore] : []), ...discoveryRows];
  }

  private tasteSignals(
    signals: UserTrackSignal[],
    favorites: Awaited<
      ReturnType<PersonalHomeRepository['findUserFavoriteSignals']>
    >,
  ): TasteSignal[] {
    return [
      ...signals.map((signal) => ({
        genres: signal.genres,
        artistKey: signal.artistKey,
        weight: signal.attempts,
        lastSignalAt: signal.lastAttemptAt,
      })),
      ...favorites.map((favorite) => ({
        genres: favorite.genres,
        artistKey: favorite.artistKey,
        weight: 1,
        lastSignalAt: favorite.createdAt,
      })),
    ];
  }

  private async linkArtistPages(
    feed: StoredPersonalHomeFeed,
  ): Promise<StoredPersonalHomeFeed> {
    if (!this.feeds.withArtistLinks) return feed;
    return { ...feed, rows: await this.feeds.withArtistLinks(feed.rows) };
  }

  /**
   * The resume rows: Tracks started but not yet accurate ("continue singing",
   * newest run first) and the User's best Tracks ("sing again", best accuracy
   * first). Each runs through the same composer, so a row below the minimum
   * size is dropped like every other feed row.
   */
  private resumeRows(
    signals: UserTrackSignal[],
    mastered: ReadonlySet<string>,
  ): HomeRow[] {
    const candidates = signals.map(toResumeCandidate);
    const bestOf = new Map(
      signals.map((signal) => [signal.trackId, signal.bestAccuracy]),
    );
    const rows: HomeRow[] = [];
    for (const descriptor of [
      {
        id: 'continue-singing',
        title: title('home.rows.continueSinging'),
        items: candidates.filter((candidate) => !mastered.has(candidate.id)),
      },
      {
        id: 'sing-again',
        title: title('home.rows.singAgain'),
        items: [...candidates].sort(
          (a, b) => (bestOf.get(b.id) ?? 0) - (bestOf.get(a.id) ?? 0),
        ),
      },
    ]) {
      const [composed] = composeHomeRows([
        { ...descriptor, layout: 'standard' as const },
      ]);
      if (!composed) {
        continue;
      }
      rows.push({
        id: composed.id,
        layout: 'standard',
        title: composed.title ?? descriptor.title,
        items: composed.items.map((item) => item.track),
      } satisfies HomeCarouselRow);
    }
    return rows;
  }

  /** The daily target strip: the time left today, with the Streak. */
  private async dailyTargetRow(
    userId: string,
    timeZone: string | null,
  ): Promise<HomeRow> {
    const status = await this.streaks.getStatus(userId, timeZone ?? undefined);
    return {
      id: 'daily-target',
      layout: 'daily-target',
      title: title('home.rows.dailyTarget'),
      secondsLeft: status.completedToday
        ? 0
        : Math.max(0, status.targetSeconds - status.listenedSeconds),
      targetSeconds: status.targetSeconds,
      streakDays: status.currentStreakDays,
      completedToday: status.completedToday,
    };
  }
}
