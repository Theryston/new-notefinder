import {
  DEFAULT_TRACK_LIMITS,
  exceededTrackRequestLimit,
  trackLimitsFrom,
  utcDayRange,
} from './track-limits.js';

const NO_ENV_LIMITS = {
  PROCESSING_ACTIVE_LIMIT: undefined,
  PROCESSING_NEW_TRACKS_DAILY_LIMIT: undefined,
  PROCESSING_MAX_DURATION_SECONDS: undefined,
};

describe('trackLimitsFrom', () => {
  it('uses the documented defaults when the env leaves the limits out', () => {
    expect(trackLimitsFrom(NO_ENV_LIMITS)).toEqual({
      activeProcessings: 3,
      newTracksPerDay: 20,
      maxDurationSeconds: 900,
    });
    expect(DEFAULT_TRACK_LIMITS).toEqual(trackLimitsFrom(NO_ENV_LIMITS));
  });

  it('uses the limits the env sets', () => {
    expect(
      trackLimitsFrom({
        PROCESSING_ACTIVE_LIMIT: 5,
        PROCESSING_NEW_TRACKS_DAILY_LIMIT: 50,
        PROCESSING_MAX_DURATION_SECONDS: 600,
      }),
    ).toEqual({
      activeProcessings: 5,
      newTracksPerDay: 50,
      maxDurationSeconds: 600,
    });
  });
});

describe('exceededTrackRequestLimit', () => {
  const limits = { activeProcessings: 3, newTracksPerDay: 20 };

  it('lets a request go ahead while the User is below both limits', () => {
    expect(
      exceededTrackRequestLimit(
        { activeProcessings: 2, newTracksToday: 19 },
        limits,
      ),
    ).toBeUndefined();
  });

  it('refuses the request that would be one more than the active limit', () => {
    expect(
      exceededTrackRequestLimit(
        { activeProcessings: 3, newTracksToday: 0 },
        limits,
      ),
    ).toEqual({ limit: 'ACTIVE_PROCESSINGS', max: 3 });
  });

  it('refuses the request that would be one more than the daily limit', () => {
    expect(
      exceededTrackRequestLimit(
        { activeProcessings: 0, newTracksToday: 20 },
        limits,
      ),
    ).toEqual({ limit: 'NEW_TRACKS_PER_DAY', max: 20 });
  });

  it('names the active limit first when both are reached', () => {
    expect(
      exceededTrackRequestLimit(
        { activeProcessings: 3, newTracksToday: 20 },
        limits,
      ),
    ).toEqual({ limit: 'ACTIVE_PROCESSINGS', max: 3 });
  });
});

describe('utcDayRange', () => {
  it('spans the UTC day that contains the instant, from its first millisecond', () => {
    const { start, end } = utcDayRange(new Date('2026-10-08T15:30:00Z'));

    expect(start.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-09T00:00:00.000Z');
  });

  it('keeps the last millisecond of a day inside it and its first one out', () => {
    const { start, end } = utcDayRange(new Date('2026-10-08T23:59:59.999Z'));

    expect(start.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(end.getTime() - 1).toBe(
      new Date('2026-10-08T23:59:59.999Z').getTime(),
    );
    expect(new Date('2026-10-09T00:00:00.000Z').getTime()).toBe(end.getTime());
  });

  it('does not depend on the time zone the process runs in', () => {
    const { start } = utcDayRange(new Date('2026-03-29T00:30:00+02:00'));

    expect(start.toISOString()).toBe('2026-03-28T00:00:00.000Z');
  });
});
