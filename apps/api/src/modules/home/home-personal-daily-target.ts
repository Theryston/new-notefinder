import type { HomeRow } from '@notefinder/contracts';
import { StreaksService } from '../streaks/streaks.service.js';

const title = (key: string) => ({ key, params: {} });

/** The daily target strip: time left today, with the streak. */
export const dailyTargetRow = async (
  streaks: StreaksService,
  userId: string,
  timeZone: string | null,
): Promise<HomeRow> => {
  const status = await streaks.getStatus(userId, timeZone ?? undefined);
  return {
    id: 'daily-target',
    layout: 'daily-target',
    title: title('home.rows.dailyTarget'),
    secondsLeft: status.completedToday
      ? 0
      : Math.max(0, status.targetSeconds - status.listenedSeconds),
    targetSeconds: status.targetSeconds,
    streakDays: status.currentStreakDays,
    completedToday: status.completedToday,
  };
};
