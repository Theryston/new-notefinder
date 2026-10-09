import type { TrackRequestLimit } from '@notefinder/contracts';
import type { Env } from '../../config/env.js';

/** What one User may hold and request, as the env sets it (see `.env.example`). */
export type TrackLimits = {
  /** Non-terminal Processings the User may have started at once. */
  activeProcessings: number;
  /** New Tracks (CREATE Contributions) the User may request per UTC day. */
  newTracksPerDay: number;
  /** The longest Recording or video a Processing accepts, in seconds. */
  maxDurationSeconds: number;
};

export const DEFAULT_TRACK_LIMITS: TrackLimits = {
  activeProcessings: 3,
  newTracksPerDay: 20,
  maxDurationSeconds: 900,
};

/** The limits the env sets, and the defaults for the ones it leaves out. */
export const trackLimitsFrom = (
  env: Pick<
    Env,
    | 'PROCESSING_ACTIVE_LIMIT'
    | 'PROCESSING_NEW_TRACKS_DAILY_LIMIT'
    | 'PROCESSING_MAX_DURATION_SECONDS'
  >,
): TrackLimits => ({
  activeProcessings:
    env.PROCESSING_ACTIVE_LIMIT ?? DEFAULT_TRACK_LIMITS.activeProcessings,
  newTracksPerDay:
    env.PROCESSING_NEW_TRACKS_DAILY_LIMIT ??
    DEFAULT_TRACK_LIMITS.newTracksPerDay,
  maxDurationSeconds:
    env.PROCESSING_MAX_DURATION_SECONDS ??
    DEFAULT_TRACK_LIMITS.maxDurationSeconds,
});

/** What a User has already used before a new request. */
export type TrackRequestUsage = {
  activeProcessings: number;
  newTracksToday: number;
};

/**
 * The first limit a new Track would go over, with its maximum, or `undefined`
 * when the request may go ahead. The request itself would be one more, so the
 * check is "already at the maximum".
 */
export const exceededTrackRequestLimit = (
  usage: TrackRequestUsage,
  limits: Pick<TrackLimits, 'activeProcessings' | 'newTracksPerDay'>,
): { limit: TrackRequestLimit; max: number } | undefined => {
  if (usage.activeProcessings >= limits.activeProcessings) {
    return { limit: 'ACTIVE_PROCESSINGS', max: limits.activeProcessings };
  }
  if (usage.newTracksToday >= limits.newTracksPerDay) {
    return { limit: 'NEW_TRACKS_PER_DAY', max: limits.newTracksPerDay };
  }
  return undefined;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The UTC day that contains `now`, as a half-open range `[start, end)`. UTC
 * has no daylight saving time, so a day is always exactly 24 hours.
 */
export const utcDayRange = (now: Date): { start: Date; end: Date } => {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
};
