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

/** What a heartbeat earns, and where the User's server-side clock stands after it. */
export type HeartbeatCredit = {
  creditedSeconds: number;
  /** The moment the next heartbeat is measured from. */
  clockAt: Date;
};

/**
 * How many of the `elapsedSeconds` a heartbeat reports are credited: at most
 * the cap per call and, once the User has an earlier heartbeat, at most the
 * time the API's own clock saw pass since it, rounded to the nearest second
 * (a 5 s timer arrives a few milliseconds early as often as late; flooring
 * would drop a second every other beat). The clock is the User's, across all
 * days and time zones, checked against the server clock as in the legacy app.
 *
 * Rounding alone would let a client that calls every half second earn a
 * second per call. So when the server's clock is what limited the credit, the
 * clock only advances by the seconds credited (it may sit up to half a second
 * ahead of `now`): bursts then share the real time instead of each rounding up.
 */
export function creditHeartbeat(options: {
  elapsedSeconds: number;
  lastHeartbeatAt: Date | null;
  now: Date;
}): HeartbeatCredit {
  const { elapsedSeconds, lastHeartbeatAt, now } = options;
  const requested = Math.min(
    Math.max(0, Math.floor(elapsedSeconds)),
    STREAK_MAX_HEARTBEAT_SECONDS,
  );
  if (lastHeartbeatAt === null) {
    return { creditedSeconds: requested, clockAt: now };
  }
  const passedMs = now.getTime() - lastHeartbeatAt.getTime();
  const allowed = Math.max(0, Math.round(passedMs / 1000));
  if (requested < allowed) {
    return { creditedSeconds: requested, clockAt: now };
  }
  return {
    creditedSeconds: allowed,
    clockAt: new Date(lastHeartbeatAt.getTime() + allowed * 1000),
  };
}
