import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { ENV, type Env } from '../../config/env.js';
import { UsersService } from '../users/users.service.js';
import {
  exceededTrackRequestLimit,
  type TrackLimits,
  trackLimitsFrom,
  utcDayRange,
} from './track-limits.js';
import { TrackProcessingRepository } from './track-processing.repository.js';

/**
 * Who asks for a Track: the User's ID and role. Better Auth types the session
 * role loosely, so only `ADMIN` is compared, as `RolesGuard` does.
 */
export type TrackRequester = { id: string; role?: string | null };

/**
 * What a Track request needs to know about the User who makes it: whether
 * their limits allow one more Track (CONTEXT.md "Processing"), and the
 * language they browse in, which their emails follow.
 *
 * Holds a User to at most a few non-terminal Processings started by them at
 * once, and a few new Tracks per UTC day. ADMIN is exempt. The request calls
 * `assertCanRequestTrack` inside its write transaction, after taking the User's
 * lock, so two of the User's requests can't both pass the check for the last
 * free slot.
 */
@Injectable()
export class TrackRequesterService {
  private readonly limits: TrackLimits;

  constructor(
    @Inject(ENV) env: Env,
    private readonly processings: TrackProcessingRepository,
    private readonly users: UsersService,
  ) {
    this.limits = trackLimitsFrom(env);
  }

  /**
   * Throws `PROCESSING_LIMIT_REACHED`, with the limit in its details, when the
   * User may not request one more Track now. Must run in a transaction: the
   * lock it takes is released when that transaction ends.
   */
  async assertCanRequestTrack(
    requester: TrackRequester,
    now: Date = new Date(),
  ): Promise<void> {
    if (requester.role === 'ADMIN') {
      return;
    }
    await this.processings.lockRequester(requester.id);
    const { start, end } = utcDayRange(now);
    const [activeProcessings, newTracksToday] = await Promise.all([
      this.processings.countActiveProcessings(requester.id),
      this.processings.countNewTracksBetween(requester.id, start, end),
    ]);
    const exceeded = exceededTrackRequestLimit(
      { activeProcessings, newTracksToday },
      this.limits,
    );
    if (exceeded !== undefined) {
      throw new AppException(
        'PROCESSING_LIMIT_REACHED',
        'Track request limit reached',
        exceeded,
      );
    }
  }

  /** Records the language the User browses in on their account. */
  recordLocale(userId: string, locale: Locale): Promise<void> {
    return this.users.setLocale(userId, locale);
  }
}
