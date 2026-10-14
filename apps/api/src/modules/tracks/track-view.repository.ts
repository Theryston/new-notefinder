import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, count, desc, eq, gte, isNull, sql, sum } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { trackViews } from '../../database/schema/track-views.js';
import { tracks } from '../../database/schema/tracks.js';

export type TrackViewStats = {
  thisHourCount: number;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  allTimeCount: number;
  globalHourAverage: number;
  globalDayAverage: number;
};

const periodStarts = (now: Date) => {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  const day = new Date(hour);
  day.setUTCHours(0, 0, 0, 0);
  const week = new Date(day);
  week.setUTCDate(week.getUTCDate() - week.getUTCDay());
  const month = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  return { hour, day, week, month };
};

const average = (counts: { value: number }[]) =>
  counts.length === 0
    ? 0
    : Math.round(
        counts.reduce((total, row) => total + row.value, 0) / counts.length,
      );

@Injectable()
export class TrackViewRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async create(trackId: string, userId: string | null): Promise<string> {
    const [view] = await this.txHost.tx
      .insert(trackViews)
      .values({ trackId, userId })
      .returning({ id: trackViews.id });
    if (view === undefined) throw new Error('Track view was not inserted');
    return view.id;
  }

  /** Attach a session's earlier anonymous view; false means the ID is unknown. */
  async attach(
    trackId: string,
    viewId: string,
    userId: string | undefined,
  ): Promise<boolean> {
    const [view] = await this.txHost.tx
      .select({ id: trackViews.id, userId: trackViews.userId })
      .from(trackViews)
      .where(and(eq(trackViews.id, viewId), eq(trackViews.trackId, trackId)))
      .limit(1);
    if (view === undefined) return false;
    if (userId !== undefined && view.userId === null) {
      await this.txHost.tx
        .update(trackViews)
        .set({ userId })
        .where(and(eq(trackViews.id, viewId), isNull(trackViews.userId)));
    }
    return true;
  }

  async countForTrack(trackId: string): Promise<number> {
    const [result] = await this.txHost.tx
      .select({ value: count() })
      .from(trackViews)
      .where(eq(trackViews.trackId, trackId));
    return result?.value ?? 0;
  }

  async findStats(trackId: string, now: Date): Promise<TrackViewStats> {
    const { hour, day, week, month } = periodStarts(now);

    const [track] = await this.txHost.tx
      .select({
        allTimeCount: count(),
        thisHourCount: sum(
          sql<number>`case when ${trackViews.viewedAt} >= ${hour} then 1 else 0 end`,
        ),
        todayCount: sum(
          sql<number>`case when ${trackViews.viewedAt} >= ${day} then 1 else 0 end`,
        ),
        thisWeekCount: sum(
          sql<number>`case when ${trackViews.viewedAt} >= ${week} then 1 else 0 end`,
        ),
        thisMonthCount: sum(
          sql<number>`case when ${trackViews.viewedAt} >= ${month} then 1 else 0 end`,
        ),
      })
      .from(trackViews)
      .where(eq(trackViews.trackId, trackId));

    const [hourCounts, dayCounts] = await Promise.all([
      this.txHost.tx
        .select({ trackId: trackViews.trackId, value: count() })
        .from(trackViews)
        .where(gte(trackViews.viewedAt, hour))
        .groupBy(trackViews.trackId),
      this.txHost.tx
        .select({ trackId: trackViews.trackId, value: count() })
        .from(trackViews)
        .where(gte(trackViews.viewedAt, day))
        .groupBy(trackViews.trackId),
    ]);

    return {
      allTimeCount: track?.allTimeCount ?? 0,
      thisHourCount: Number(track?.thisHourCount ?? 0),
      todayCount: Number(track?.todayCount ?? 0),
      thisWeekCount: Number(track?.thisWeekCount ?? 0),
      thisMonthCount: Number(track?.thisMonthCount ?? 0),
      globalHourAverage: average(hourCounts),
      globalDayAverage: average(dayCounts),
    };
  }

  async updateTrendingScore(trackId: string, score: number): Promise<void> {
    await this.txHost.tx
      .update(tracks)
      .set({ trendingScore: score })
      .where(eq(tracks.id, trackId));
  }

  async findSitemapTrackIds(): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ id: tracks.id })
      .from(tracks)
      .where(hasCompletedProcessing(tracks.id))
      .orderBy(desc(tracks.trendingScore), asc(tracks.id))
      .limit(50_000);
    return rows.map(({ id }) => id);
  }
}
