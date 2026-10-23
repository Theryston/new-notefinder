import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  HomeCarouselRow,
  HomeRow,
  HomeRowTitle,
  HomeTrack,
  Locale,
  TrackVocalRange,
} from '@notefinder/contracts';
import { AttemptsService } from '../attempts/attempts.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { UsersService } from '../users/users.service.js';
import type { StoredPersonalHomeFeed } from './home-feed.js';
import { HomeFeedService } from './home-feed.service.js';
import { composeHomeRows } from './home-feed-composer.js';
import { isMasteredTrack, personalLambda } from './home-personal.js';
import {
  PersonalHomeRepository,
  type UserFavoriteSignal,
  type UserTrackSignal,
} from './home-personal.repository.js';
import { buildTaste } from './home-personal-blend.js';
import {
  blendedDiscoveryPool,
  buildPersonalDiscoveryRows,
} from './home-personal-discovery.js';
import {
  buildPersonalVoiceRows,
  personalTrackPool,
  personalVoiceRowTrackIds,
} from './home-personal-voice.js';
import { DEFAULT_HOME_LOCALE, HOME_ALGORITHM_VERSION } from './home-rules.js';

const title = (key: string): HomeRowTitle => ({ key, params: {} });

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
  @Optional()
  @Inject(AttemptsService)
  private readonly attempts?: AttemptsService;

  constructor(
    private readonly feeds: HomeFeedService,
    private readonly personal: PersonalHomeRepository,
    private readonly streaks: StreaksService,
    private readonly users: UsersService,
  ) {}

  async build(
    userId: string,
    locale: Locale = DEFAULT_HOME_LOCALE,
  ): Promise<StoredPersonalHomeFeed> {
    const [{ feed }, signals, favorites, settings, userRange] =
      await Promise.all([
        this.feeds.currentPublic(locale),
        this.personal.findUserTrackSignals(userId),
        this.personal.findUserFavoriteSignals(userId),
        this.users.getPracticeSettings(userId),
        this.attempts?.vocalRange(userId) ?? Promise.resolve(null),
      ]);
    const rows = await this.personalRowsFor({
      userId,
      timeZone: settings.timeZone,
      publicRows: feed.rows,
      signals,
      favorites,
      userRange,
    });
    return {
      audience: 'personal',
      locale,
      version: versionOf(userId, locale, rows),
      algorithmVersion: HOME_ALGORITHM_VERSION,
      rows,
      generatedAt: new Date().toISOString(),
    };
  }

  private async personalRowsFor(options: {
    userId: string;
    timeZone: string | null;
    publicRows: HomeRow[];
    signals: UserTrackSignal[];
    favorites: UserFavoriteSignal[];
    userRange: TrackVocalRange | null;
  }): Promise<HomeRow[]> {
    const { userId, timeZone, publicRows, signals, favorites, userRange } =
      options;
    const { taste, signalCount } = buildTaste(signals, favorites);
    const lambda = personalLambda(signalCount);
    const mastered = new Set(
      signals
        .filter((signal) => isMasteredTrack(signal.bestAccuracy))
        .map((signal) => signal.trackId),
    );
    const resumeRows = this.resumeRows(signals, mastered);
    const resumeTrackIds = new Set(
      resumeRows
        .flatMap((row) => (row.layout === 'standard' ? row.items : []))
        .map((track) => track.id),
    );
    const pool = personalTrackPool(publicRows);
    const discovery = await this.personal.findDiscoveryTracks([
      ...new Set(pool.map((track) => track.id)),
    ]);
    const blended = blendedDiscoveryPool({
      publicRows,
      discovery,
      taste,
      lambda,
      masteredTrackIds: mastered,
      userRange,
    });
    const voiceRows = userRange
      ? buildPersonalVoiceRows({
          rows: publicRows,
          userRange,
          discovery,
          masteredTrackIds: mastered,
          alreadyUsedTrackIds: resumeTrackIds,
        })
      : [];
    const usedTrackIds = new Set([
      ...resumeTrackIds,
      ...personalVoiceRowTrackIds(voiceRows),
    ]);
    const rows: HomeRow[] = [
      ...resumeRows,
      await this.dailyTargetRow(userId, timeZone),
      ...voiceRows,
      ...buildPersonalDiscoveryRows({
        publicRows,
        sorted: blended,
        masteredTrackIds: mastered,
        alreadyUsedTrackIds: usedTrackIds,
      }),
    ];
    return rows;
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
