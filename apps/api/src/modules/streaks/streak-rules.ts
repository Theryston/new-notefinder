import { STREAK_MAX_HEARTBEAT_SECONDS } from '@notefinder/contracts';

/** The target of a User who never picked one, as in the legacy app. */
export const DEFAULT_TARGET_SECONDS = 5 * 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The calendar day (`YYYY-MM-DD`) it is at `now` in `timeZone`. */
export function localDayOf(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The day before `day`; calendar arithmetic, so time zones do not matter. */
export function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/**
 * The run of consecutive completed days ending today, or ending yesterday
 * while today is still open (the User still has the day to keep the streak).
 */
export function currentStreakDays(
  completedDays: ReadonlySet<string>,
  today: string,
): number {
  let cursor = completedDays.has(today) ? today : previousDay(today);
  let days = 0;
  while (completedDays.has(cursor)) {
    days += 1;
    cursor = previousDay(cursor);
  }
  return days;
}

/**
 * How many of the `elapsedSeconds` a heartbeat reports are credited: at most
 * the cap per call, and, once there is an earlier heartbeat, at most what the
 * API's own clock saw pass since it (checked against the server clock, as in
 * the legacy app, so a client cannot claim time it did not spend).
 */
export function creditedSecondsOf(options: {
  elapsedSeconds: number;
  lastHeartbeatAt: Date | null;
  now: Date;
}): number {
  const { elapsedSeconds, lastHeartbeatAt, now } = options;
  const requested = Math.min(
    Math.max(0, Math.floor(elapsedSeconds)),
    STREAK_MAX_HEARTBEAT_SECONDS,
  );
  if (lastHeartbeatAt === null) {
    return requested;
  }
  const passed = (now.getTime() - lastHeartbeatAt.getTime()) / 1000;
  const allowed = Math.max(0, Math.floor(passed));
  return Math.min(requested, allowed);
}
