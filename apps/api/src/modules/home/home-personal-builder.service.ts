import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  HomeCarouselRow,
  HomeHero,
  HomeRow,
  HomeRowTitle,
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
import {
  blendDiscoveryCandidates,
  buildTaste,
  byBlendedDesc,
  type DiscoveryCandidate,
} from './home-personal-blend.js';
import { DEFAULT_HOME_LOCALE, HOME_ALGORITHM_VERSION } from './home-rules.js';
import { HomeSocialService } from './home-social.service.js';

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
  constructor(
    private readonly feeds: HomeFeedService,
    private readonly personal: PersonalHomeRepository,
    private readonly streaks: StreaksService,
    private readonly users: UsersService,
  ) {}

  @Optional()
  @Inject(HomeSocialService)
  private readonly social?: HomeSocialService;

  async build(
    userId: string,
    locale: Locale = DEFAULT_HOME_LOCALE,
  ): Promise<StoredPersonalHomeFeed> {
    const [{ feed }, signals, favorites, settings, socialRows] =
      await Promise.all([
        this.feeds.currentPublic(locale),
        this.personal.findUserTrackSignals(userId),
        this.personal.findUserFavoriteSignals(userId),
        this.users.getPracticeSettings(userId),
        this.social?.rowsFor(userId) ?? Promise.resolve([]),
      ]);
    const { taste, signalCount } = buildTaste(signals, favorites);
    const lambda = personalLambda(signalCount);
    const mastered = new Set(
      signals
        .filter((signal) => isMasteredTrack(signal.bestAccuracy))
        .map((signal) => signal.trackId),
    );
    const rows: HomeRow[] = [
      ...this.resumeRows(signals, mastered),
      await this.dailyTargetRow(userId, settings.timeZone),
      ...socialRows,
      ...(await this.discoveryRows(feed.rows, taste, lambda, mastered)),
    ];
    return {
      audience: 'personal',
      locale,
      version: versionOf(userId, locale, rows),
      algorithmVersion: HOME_ALGORITHM_VERSION,
      rows,
      generatedAt: new Date().toISOString(),
    };
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

  /**
   * The public rows re-ranked by the blend. Each standard row keeps its own
   * Tracks (reordered, mastered ones filtered) through the same composer; the
   * hero is the top blended Track with a cover, kept out of the rows below
   * like the public hero. A User with no data keeps the public rows as they
   * are.
   */
  private async discoveryRows(
    publicRows: HomeRow[],
    taste: PersonalTaste,
    lambda: number,
    mastered: ReadonlySet<string>,
  ): Promise<HomeRow[]> {
    const sorted = await this.blendedPool(publicRows, taste, lambda, mastered);
    const hero = this.discoveryHeroRow(sorted);
    return [
      ...(hero ? [hero] : []),
      ...this.discoveryStandardRows(publicRows, sorted, mastered),
    ];
  }

  /** The public Tracks with their blend inputs, best blended first. */
  private async blendedPool(
    publicRows: HomeRow[],
    taste: PersonalTaste,
    lambda: number,
    mastered: ReadonlySet<string>,
  ): Promise<DiscoveryCandidate[]> {
    const pool = publicRows.flatMap((row) =>
      row.layout === 'hero'
        ? [row.track]
        : row.layout === 'standard'
          ? row.items
          : [],
    );
    const ids = [...new Set(pool.map((track) => track.id))];
    const discovery = await this.personal.findDiscoveryTracks(ids);
    return blendDiscoveryCandidates({ tracks: pool, discovery, taste, lambda })
      .filter((candidate) => !mastered.has(candidate.track.id))
      .sort(byBlendedDesc);
  }

  /** The hero: the top blended Track with a cover. */
  private discoveryHeroRow(sorted: DiscoveryCandidate[]): HomeRow | undefined {
    const heroTrack = sorted.find((candidate) => candidate.hasCover)?.track;
    return heroTrack
      ? ({ id: 'hero', layout: 'hero', track: heroTrack } satisfies HomeHero)
      : undefined;
  }

  /** Each public standard row with its own Tracks, reordered by the blend. */
  private discoveryStandardRows(
    publicRows: HomeRow[],
    sorted: DiscoveryCandidate[],
    mastered: ReadonlySet<string>,
  ): HomeRow[] {
    const heroId = sorted.find((candidate) => candidate.hasCover)?.track.id;
    const blended = new Map(
      sorted.map((candidate) => [candidate.track.id, candidate]),
    );
    const rows: HomeRow[] = [];
    for (const row of publicRows) {
      if (row.layout !== 'standard') {
        continue;
      }
      const [composed] = composeHomeRows([
        {
          id: row.id,
          layout: 'standard' as const,
          title: row.title,
          items: row.items
            .map((track) => blended.get(track.id))
            .filter(
              (candidate): candidate is DiscoveryCandidate =>
                candidate !== undefined &&
                candidate.track.id !== heroId &&
                !mastered.has(candidate.track.id),
            )
            .sort(byBlendedDesc)
            .map((candidate) => ({
              id: candidate.track.id,
              artistKey: candidate.artistKey,
              hasCover: candidate.hasCover,
              isCompleted: true,
            })),
        },
      ]);
      if (!composed?.title) {
        continue;
      }
      const itemsById = new Map(row.items.map((track) => [track.id, track]));
      rows.push({
        id: composed.id,
        layout: 'standard',
        title: composed.title,
        items: composed.items.map((item) => {
          const track = itemsById.get(item.id);
          if (!track) {
            throw new Error(`Discovery row lost Track ${item.id}`);
          }
          return track;
        }),
      } satisfies HomeCarouselRow);
    }
    return rows;
  }
}
