import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type {
  StreakHeartbeatBody,
  StreakHeartbeatResult,
  StreakStatus,
} from '@notefinder/contracts';
import { UsersService } from '../users/users.service.js';
import {
  creditedSecondsOf,
  currentStreakDays,
  DEFAULT_TARGET_SECONDS,
  localDayOf,
} from './streak-rules.js';
import {
  type PracticeDayRow,
  StreaksRepository,
} from './streaks.repository.js';

const FALLBACK_TIME_ZONE = 'UTC';

const validTarget = (seconds: number | null): number =>
  seconds !== null && seconds > 0
    ? Math.floor(seconds)
    : DEFAULT_TARGET_SECONDS;

/**
 * The daily practice streak. A heartbeat credits listening time to the User's
 * current day, which is the calendar day in their time zone, so it rolls over
 * at their midnight. A day is completed when it reaches the User's daily
 * target, and the streak is the run of completed days.
 */
@Injectable()
export class StreaksService {
  constructor(
    private readonly streaks: StreaksRepository,
    private readonly users: UsersService,
  ) {}

  /** Where today stands, in `timeZone` or the one the last heartbeat kept. */
  async getStatus(
    userId: string,
    timeZone: string | undefined,
  ): Promise<StreakStatus> {
    const settings = await this.users.getPracticeSettings(userId);
    const zone = timeZone ?? settings.timeZone ?? FALLBACK_TIME_ZONE;
    const day = localDayOf(new Date(), zone);
    return this.statusOf(
      userId,
      await this.streaks.findDay(userId, day),
      day,
      validTarget(settings.dailyPracticeTargetSeconds),
    );
  }

  /**
   * Credits the heartbeat (see `creditedSecondsOf`), keeps the time zone it
   * names and completes the day when the target is reached. Two heartbeats of
   * one User run one after the other (the day's row is locked), so only one of
   * them can complete the day.
   */
  @Transactional()
  async heartbeat(
    userId: string,
    body: StreakHeartbeatBody,
  ): Promise<StreakHeartbeatResult> {
    const now = new Date();
    const settings = await this.users.getPracticeSettings(userId);
    if (settings.timeZone !== body.timeZone) {
      await this.users.setTimeZone(userId, body.timeZone);
    }
    const day = localDayOf(now, body.timeZone);
    const row = await this.streaks.lockDay(userId, day);
    const target = validTarget(settings.dailyPracticeTargetSeconds);

    const creditedSeconds = creditedSecondsOf({
      elapsedSeconds: body.elapsedSeconds,
      lastHeartbeatAt: row.lastHeartbeatAt,
      now,
    });
    // A heartbeat with nothing to credit is not a sign of life: leaving the
    // last heartbeat alone keeps the clock check honest.
    if (body.elapsedSeconds < 1) {
      return {
        status: await this.statusOf(userId, row, day, target),
        justCompleted: false,
        creditedSeconds: 0,
      };
    }

    const listenedSeconds = row.listenedSeconds + creditedSeconds;
    const justCompleted = !row.completed && listenedSeconds >= target;
    await this.streaks.saveHeartbeat(row.id, {
      listenedSeconds,
      heartbeatAt: now,
      completesDay: justCompleted,
    });
    const saved: PracticeDayRow = {
      ...row,
      listenedSeconds,
      completed: row.completed || justCompleted,
    };
    return {
      status: await this.statusOf(userId, saved, day, target),
      justCompleted,
      creditedSeconds,
    };
  }

  private async statusOf(
    userId: string,
    row: PracticeDayRow | undefined,
    day: string,
    targetSeconds: number,
  ): Promise<StreakStatus> {
    const completedToday = row?.completed ?? false;
    const completedDays = new Set(await this.streaks.findCompletedDays(userId));
    return {
      day,
      listenedSeconds: completedToday
        ? targetSeconds
        : Math.min(row?.listenedSeconds ?? 0, targetSeconds),
      targetSeconds,
      completedToday,
      currentStreakDays: currentStreakDays(completedDays, day),
    };
  }
}
