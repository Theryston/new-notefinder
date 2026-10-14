/** Counts used by the legacy Track ranking formula. */
export type TrendingCounts = {
  thisHourCount: number;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  allTimeCount: number;
  globalHourAverage: number;
  globalDayAverage: number;
};

/** Keeps the Track page and sitemap on the formula used by the legacy app. */
export function trendingScore(counts: TrendingCounts): number {
  const {
    thisHourCount,
    todayCount,
    thisWeekCount,
    thisMonthCount,
    allTimeCount,
    globalHourAverage,
    globalDayAverage,
  } = counts;
  const localHourTrend = (thisHourCount * 24) / (thisWeekCount / 7 + 1);
  const localDayTrend = (todayCount * 7) / (thisWeekCount + 1);
  const globalHourTrend = thisHourCount / (globalHourAverage + 1);
  const globalDayTrend = todayCount / (globalDayAverage + 1);
  const hybridHourTrend = localHourTrend ** 0.3 * globalHourTrend ** 0.4;
  const hybridDayTrend = localDayTrend ** 0.3 * globalDayTrend ** 0.4;
  const trendBoost =
    1 + Math.min(hybridHourTrend * 0.6 + hybridDayTrend * 0.4, 4);
  const baseScore =
    thisHourCount * 1.5 +
    todayCount * 1.2 +
    thisWeekCount * 1.1 +
    thisMonthCount;
  return Math.round(baseScore * Math.log10(1 + allTimeCount) * trendBoost);
}
