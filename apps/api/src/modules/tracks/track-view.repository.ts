import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, gte, isNull, type SQL, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackViews } from '../../database/schema/track-views.js';
import { tracks } from '../../database/schema/tracks.js';
import {
  averageViewsPerTrack,
  type PlatformViewAverages,
  type TrackViewCounts,
} from './trending-score.js';
import type { ViewWindowStarts } from './view-windows.js';

/** The views at or after `start`, as a number. */
const viewsSince = (start: Date): SQL<number> =>
  sql<number>`count(*) filter (where ${trackViews.createdAt} >= ${start.toISOString()}::timestamptz)`.mapWith(
    Number,
  );

/** The Tracks with a view at or after `start`, as a number. */
const tracksViewedSince = (start: Date): SQL<number> =>
  sql<number>`count(distinct ${trackViews.trackId}) filter (where ${trackViews.createdAt} >= ${start.toISOString()}::timestamptz)`.mapWith(
    Number,
  );

/** A recorded view, as far as attaching a User to it needs. */
export type StoredView = { id: string; userId: string | null };

/** Track views and the numbers the trending score is made of. */
@Injectable()
export class TrackViewRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async create(trackId: string, userId: string | null): Promise<string> {
    const [row] = await this.txHost.tx
      .insert(trackViews)
      .values({ trackId, userId })
      .returning({ id: trackViews.id });
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return row.id;
  }

  /** The view, only when it belongs to the Track. */
  async findView(
    viewId: string,
    trackId: string,
  ): Promise<StoredView | undefined> {
    const [row] = await this.txHost.tx
      .select({ id: trackViews.id, userId: trackViews.userId })
      .from(trackViews)
      .where(and(eq(trackViews.id, viewId), eq(trackViews.trackId, trackId)))
      .limit(1);
    return row;
  }

  /** Attaches the User to a view nobody owns; an owned view is left alone. */
  async attachUser(viewId: string, userId: string): Promise<void> {
    await this.txHost.tx
      .update(trackViews)
      .set({ userId })
      .where(and(eq(trackViews.id, viewId), isNull(trackViews.userId)));
  }

  /** The Track's views per window and over all time. */
  async countTrackViews(
    trackId: string,
    starts: ViewWindowStarts,
  ): Promise<TrackViewCounts> {
    const [row] = await this.txHost.tx
      .select({
        hour: viewsSince(starts.hour),
        day: viewsSince(starts.day),
        week: viewsSince(starts.week),
        month: viewsSince(starts.month),
        allTime: sql<number>`count(*)`.mapWith(Number),
      })
      .from(trackViews)
      .where(eq(trackViews.trackId, trackId));
    return row ?? { hour: 0, day: 0, week: 0, month: 0, allTime: 0 };
  }

  /** Views per viewed Track on the platform, this hour and today. */
  async platformAverages(
    starts: ViewWindowStarts,
  ): Promise<PlatformViewAverages> {
    // The hour is inside the day, so nothing before the day matters.
    const [row] = await this.txHost.tx
      .select({
        hourViews: viewsSince(starts.hour),
        hourTracks: tracksViewedSince(starts.hour),
        dayViews: viewsSince(starts.day),
        dayTracks: tracksViewedSince(starts.day),
      })
      .from(trackViews)
      .where(gte(trackViews.createdAt, starts.day));
    return {
      hour: averageViewsPerTrack(row?.hourViews ?? 0, row?.hourTracks ?? 0),
      day: averageViewsPerTrack(row?.dayViews ?? 0, row?.dayTracks ?? 0),
    };
  }

  async setTrendingScore(trackId: string, score: number): Promise<void> {
    await this.txHost.tx
      .update(tracks)
      .set({ trendingScore: score })
      .where(eq(tracks.id, trackId));
  }
}
