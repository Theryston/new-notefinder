import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception.js';

export type ScheduleInput = {
  id: string;
  subscription: string;
  schedule: string | null;
  currentPrice: string;
  nextPrice: string;
  nextCycle: 'monthly' | 'annual';
  previousPrice: string | null;
  previousCycle: 'monthly' | 'annual' | null;
  start: number;
  end: number;
};
export function schedulePhases(input: ScheduleInput) {
  return {
    end_behavior: 'release',
    proration_behavior: 'none',
    'phases[0][start_date]': String(input.start),
    'phases[0][end_date]': String(input.end),
    'phases[0][items][0][price]': input.currentPrice,
    'phases[0][items][0][quantity]': '1',
    'phases[0][proration_behavior]': 'none',
    'phases[1][start_date]': String(input.end),
    'phases[1][items][0][price]': input.nextPrice,
    'phases[1][items][0][quantity]': '1',
    'phases[1][proration_behavior]': 'none',
    'phases[1][duration][interval]':
      input.nextCycle === 'annual' ? 'year' : 'month',
    'phases[1][duration][interval_count]': '1',
  };
}

const scheduleSchema = z.object({
  id: z.string(),
  livemode: z.literal(false),
  subscription: z.string(),
  status: z.literal('active'),
  phases: z
    .array(
      z
        .object({
          start_date: z.number(),
          end_date: z.number(),
          items: z
            .array(
              z
                .object({ price: z.string(), quantity: z.literal(1) })
                .passthrough(),
            )
            .length(1),
        })
        .passthrough(),
    )
    .min(1)
    .max(2),
});
function emptySetting(value: unknown): boolean {
  return (
    value == null ||
    value === false ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}
function safePhase(phase: z.infer<typeof scheduleSchema>['phases'][number]) {
  const ignored = new Set([
    'start_date',
    'end_date',
    'items',
    'currency',
    'proration_behavior',
  ]);
  const safe = Object.entries(phase).every(
    ([key, value]) => ignored.has(key) || emptySetting(value),
  );
  const item = phase.items[0];
  return (
    safe &&
    item &&
    Object.entries(item).every(
      ([key, value]) =>
        key === 'price' ||
        key === 'quantity' ||
        (key === 'plan' && value === item.price) ||
        emptySetting(value),
    )
  );
}
function phaseEnd(start: number, cycle: 'monthly' | 'annual') {
  const original = new Date(start * 1000);
  const target = new Date(original);
  const day = target.getUTCDate();
  target.setUTCDate(1);
  if (cycle === 'annual') target.setUTCFullYear(target.getUTCFullYear() + 1);
  else target.setUTCMonth(target.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return Math.floor(target.getTime() / 1000);
}

export function validateSchedule(
  raw: unknown,
  input: ScheduleInput,
  scheduleId: string,
  requireFuture = false,
) {
  const schedule = scheduleSchema.safeParse(raw);
  const phases = schedule.success ? schedule.data.phases : [];
  const current = phases[0];
  const future = phases[1];
  if (
    !schedule.success ||
    schedule.data.id !== scheduleId ||
    schedule.data.subscription !== input.subscription ||
    !current ||
    !safePhase(current) ||
    current.start_date !== input.start ||
    current.end_date !== input.end ||
    current.items[0]?.price !== input.currentPrice ||
    (requireFuture && future?.items[0]?.price !== input.nextPrice) ||
    (future &&
      (!safePhase(future) ||
        future.start_date !== input.end ||
        ![input.previousPrice, input.nextPrice].includes(
          future.items[0]?.price ?? null,
        ) ||
        future.end_date !==
          phaseEnd(
            input.end,
            future.items[0]?.price === input.nextPrice
              ? input.nextCycle
              : (input.previousCycle ?? input.nextCycle),
          )))
  )
    throw new AppException(
      'CONFLICT',
      'Stripe schedule contains unrecognised terms',
    );
}
