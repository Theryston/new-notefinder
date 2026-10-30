import { schedulePhases, validateSchedule } from './stripe-schedule.js';

const input = {
  id: 'change',
  subscription: 'sub',
  schedule: 'sched',
  currentPrice: 'old',
  nextPrice: 'new',
  nextCycle: 'monthly' as const,
  previousPrice: null,
  previousCycle: null,
  start: 1767225600,
  end: 1769904000,
  trialEnd: 1769904000,
};
const schedule = {
  id: 'sched',
  livemode: false,
  subscription: 'sub',
  status: 'active',
  phases: [
    {
      start_date: input.start,
      end_date: input.end,
      trial_end: input.trialEnd,
      items: [{ price: 'old', quantity: 1 }],
    },
  ],
};

describe('price changes during a trial', () => {
  it('preserves the trial through the existing end date', () => {
    expect(schedulePhases(input)).toMatchObject({
      'phases[0][trial_end]': String(input.end),
    });
    expect(validateSchedule(schedule, input, 'sched')).toBeNull();
  });
  it('refuses a schedule that would shorten or omit the promised trial', () => {
    expect(() =>
      validateSchedule(
        {
          ...schedule,
          phases: [{ ...schedule.phases[0], trial_end: input.end - 1 }],
        },
        input,
        'sched',
      ),
    ).toThrow();
    expect(() =>
      validateSchedule(
        { ...schedule, phases: [{ ...schedule.phases[0], trial_end: null }] },
        input,
        'sched',
      ),
    ).toThrow();
  });
  it('accepts the unchanged paid phase Stripe creates after a trial', () => {
    const initial = {
      ...schedule,
      phases: [
        { ...schedule.phases[0], trial: true },
        {
          start_date: input.end,
          end_date: 1772323200,
          trial_end: null,
          items: [{ price: 'old', quantity: 1 }],
        },
      ],
    };
    expect(validateSchedule(initial, input, 'sched')).toBe('old');
  });
});
