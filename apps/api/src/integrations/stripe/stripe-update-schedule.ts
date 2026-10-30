import { AppException } from '../../common/errors/app-exception.js';
import type { StripeSubscription } from './stripe-billing-schemas.js';
import { releaseSchedule } from './stripe-release-schedule.js';
import {
  type ScheduleInput,
  scheduleForProvider,
  schedulePhases,
  validateSchedule,
} from './stripe-schedule.js';

type Request = (
  path: string,
  body?: Record<string, string>,
  key?: string,
) => Promise<unknown>;

export async function updateSchedule(
  input: ScheduleInput,
  provider: StripeSubscription,
  request: Request,
) {
  const scheduled = scheduleForProvider(input, provider);
  if (input.nextPrice === input.currentPrice)
    return releaseSchedule(scheduled, provider.schedule, request);
  if (!input.schedule)
    throw new AppException('CONFLICT', 'Subscription schedule is missing');
  validateSchedule(
    await request(
      `subscription_schedules/${encodeURIComponent(input.schedule)}`,
    ),
    scheduled,
    input.schedule,
  );
  const result = await request(
    `subscription_schedules/${encodeURIComponent(input.schedule)}`,
    schedulePhases(scheduled),
    `change-${input.id}`,
  );
  validateSchedule(result, scheduled, input.schedule, true);
}
