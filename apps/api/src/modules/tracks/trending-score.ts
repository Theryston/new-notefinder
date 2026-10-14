/**
 * Views of one Track in the calendar windows that end now: since the start of
 * the hour, the day, the week and the month, and over all time. Each window
 * contains the shorter ones (a month that began this week counts the same
 * views as the week).
 */
export type TrackViewCounts = {
  hour: number;
  day: number;
  week: number;
  month: number;
  allTime: number;
};

/**
 * How many views a Track that was viewed at all has on average on the
 * platform, this hour and today: views divided by the Tracks viewed in the
 * window, rounded, 0 when nothing was viewed.
 */
export type PlatformViewAverages = {
  hour: number;
  day: number;
};

/** The platform average of a window: views per Track viewed in it. */
export const averageViewsPerTrack = (
  views: number,
  tracksViewed: number,
): number => Math.round(views / tracksViewed) || 0;

// The legacy formula's constants (`trigger/calculate-score.ts` of the legacy
// app), kept as they were so the ranking does not change.
const LOCAL_WEIGHT = 0.3;
const GLOBAL_WEIGHT = 0.4;
const HOUR_TREND_SHARE = 0.6;
const DAY_TREND_SHARE = 0.4;
const MAX_TREND = 4;
const WINDOW_WEIGHTS = { hour: 1.5, day: 1.2, week: 1.1, month: 1 } as const;
const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;

/**
 * A window's trend: how much the Track beats its own weekly rhythm (local) and
 * the platform's average Track (global), blended geometrically. The `+ 1`s
 * keep every ratio finite for a quiet Track or a quiet platform.
 */
const hybridTrend = (local: number, global: number): number =>
  local ** LOCAL_WEIGHT * global ** GLOBAL_WEIGHT;

/**
 * The trending score of a Track, from its views and the platform's averages:
 * the recent views weighted by how recent they are, scaled by the log of its
 * all-time views and boosted (up to 5x) when it is trending against both its
 * own week and the platform. A Track nobody viewed scores 0.
 */
export function trendingScore(
  views: TrackViewCounts,
  platform: PlatformViewAverages,
): number {
  const localHour =
    (views.hour * HOURS_PER_DAY) / (views.week / DAYS_PER_WEEK + 1);
  const localDay = (views.day * DAYS_PER_WEEK) / (views.week + 1);
  const trend =
    HOUR_TREND_SHARE *
      hybridTrend(localHour, views.hour / (platform.hour + 1)) +
    DAY_TREND_SHARE * hybridTrend(localDay, views.day / (platform.day + 1));
  const boost = 1 + Math.min(trend, MAX_TREND);
  const base =
    WINDOW_WEIGHTS.hour * views.hour +
    WINDOW_WEIGHTS.day * views.day +
    WINDOW_WEIGHTS.week * views.week +
    WINDOW_WEIGHTS.month * views.month;
  return Math.round(base * Math.log10(1 + views.allTime) * boost);
}
