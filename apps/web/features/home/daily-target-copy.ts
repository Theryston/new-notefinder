/**
 * The words of the daily target strip, as translation keys with their
 * parameters: the component translates them, so this pure mapping is the part
 * Vitest covers.
 */

/** Minutes shown for seconds left: a partial minute counts as a whole one. */
export const minutesLeftOf = (secondsLeft: number): number =>
  Math.max(0, Math.ceil(secondsLeft / 60));

/** Whole minutes of the User's daily target. */
export const minutesTotalOf = (targetSeconds: number): number =>
  Math.max(1, Math.round(targetSeconds / 60));

export type DailyTargetCopy =
  | {
      key: 'home.dailyTarget.remaining';
      params: { minutesLeft: number; minutesTotal: number };
    }
  | { key: 'home.dailyTarget.completeToday'; params: Record<string, never> };

/**
 * The strip's main line: what is left of the goal, or that the day is
 * complete. A completed day reads as complete even with seconds to spare.
 */
export function dailyTargetCopy(status: {
  secondsLeft: number;
  targetSeconds: number;
  completedToday: boolean;
}): DailyTargetCopy {
  if (status.completedToday || status.secondsLeft <= 0) {
    return { key: 'home.dailyTarget.completeToday', params: {} };
  }
  return {
    key: 'home.dailyTarget.remaining',
    params: {
      minutesLeft: minutesLeftOf(status.secondsLeft),
      minutesTotal: minutesTotalOf(status.targetSeconds),
    },
  };
}
