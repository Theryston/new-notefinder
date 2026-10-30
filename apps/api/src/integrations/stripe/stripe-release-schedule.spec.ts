import { parseEnv } from '../../config/env.js';
import { StripeBillingService } from './stripe-billing.service.js';
import type { StripeSubscription } from './stripe-billing-schemas.js';
import type { ScheduleInput } from './stripe-schedule.js';

const start = Math.floor(Date.now() / 1000);
const input: ScheduleInput = {
  id: 'restore-monthly',
  subscription: 'sub_restore',
  schedule: 'sched_restore',
  currentPrice: 'price_monthly',
  nextPrice: 'price_monthly',
  nextCycle: 'monthly',
  previousPrice: 'price_annual',
  previousCycle: 'annual',
  start,
  end: start + 3600,
};
const provider: StripeSubscription = {
  id: input.subscription,
  livemode: false,
  customer: 'cus_restore',
  status: 'active',
  currency: 'usd',
  cancel_at_period_end: false,
  schedule: input.schedule,
  latest_invoice: { status: 'paid', amount_paid: 350 },
  items: {
    data: [
      {
        price: { id: input.currentPrice, unit_amount: 350, currency: 'usd' },
        current_period_start: input.start,
        current_period_end: input.end,
      },
    ],
  },
};
const futureEnd = new Date(input.end * 1000);
futureEnd.setUTCFullYear(futureEnd.getUTCFullYear() + 1);
const schedule = {
  id: input.schedule,
  livemode: false,
  status: 'active',
  subscription: input.subscription,
  phases: [
    {
      start_date: input.start,
      end_date: input.end,
      items: [{ price: input.currentPrice, quantity: 1 }],
    },
    {
      start_date: input.end,
      end_date: futureEnd.getTime() / 1000,
      items: [{ price: input.previousPrice, quantity: 1 }],
    },
  ],
};
const released = {
  id: input.schedule,
  livemode: false,
  status: 'released',
  released_subscription: input.subscription,
};
const stripe = new StripeBillingService(
  parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/restore',
    REDIS_URL: 'redis://localhost',
    STRIPE_SECRET_KEY: 'sk_test_restore',
  }),
);

describe('Restoring the existing subscription offer', () => {
  const network = vi.fn<typeof fetch>();
  beforeEach(() => {
    network.mockReset();
    vi.stubGlobal('fetch', network);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('releases the future phases without changing the current subscription', async () => {
    network
      .mockResolvedValueOnce(Response.json(provider))
      .mockResolvedValueOnce(Response.json(schedule))
      .mockResolvedValueOnce(Response.json(released));
    await stripe.scheduleChange(input);
    expect(network).toHaveBeenCalledTimes(3);
    expect(network.mock.calls[2]?.[0]).toBe(
      'https://api.stripe.com/v1/subscription_schedules/sched_restore/release',
    );
    expect(network.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      body: '',
      headers: { 'Idempotency-Key': 'release-restore-monthly' },
    });
  });

  it('reuses the attached schedule and does not create one to restore the existing offer', async () => {
    network.mockResolvedValue(Response.json(provider));
    expect(await stripe.prepareSchedule(input)).toBe(input.schedule);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('recovers a completed release after the provider response was lost', async () => {
    network.mockImplementation(async () =>
      Response.json({ ...provider, schedule: null }),
    );
    expect(await stripe.inspectSchedule(input)).toBe('pending');
    expect(await stripe.prepareSchedule(input)).toBeNull();
    await stripe.scheduleChange({ ...input, schedule: null });
    expect(
      network.mock.calls.every(([, options]) => options?.method === 'GET'),
    ).toBe(true);
  });

  it('uses a fresh creation key when scheduling again after a release', async () => {
    network
      .mockResolvedValueOnce(Response.json({ ...provider, schedule: null }))
      .mockResolvedValueOnce(
        Response.json({ id: 'sched_restore', livemode: false }),
      )
      .mockResolvedValueOnce(Response.json(schedule));
    await stripe.prepareSchedule({
      ...input,
      id: 'new-attempt',
      schedule: null,
      nextPrice: 'price_annual',
      nextCycle: 'annual',
    });
    expect(network.mock.calls[1]?.[1]?.headers).toMatchObject({
      'Idempotency-Key': 'schedule-new-attempt',
    });
  });

  it('retains local scheduling state when the provider release fails', async () => {
    network
      .mockResolvedValueOnce(Response.json(provider))
      .mockResolvedValueOnce(Response.json(schedule))
      .mockResolvedValueOnce(Response.json({ error: {} }, { status: 503 }));
    await expect(stripe.scheduleChange(input)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('rejects an unconfirmed release and refuses unknown schedule terms', async () => {
    network
      .mockResolvedValueOnce(Response.json(provider))
      .mockResolvedValueOnce(Response.json(schedule))
      .mockResolvedValueOnce(Response.json({ ...released, status: 'active' }));
    await expect(stripe.scheduleChange(input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    network
      .mockResolvedValueOnce(Response.json(provider))
      .mockResolvedValueOnce(Response.json({ ...schedule, phases: [] }));
    await expect(stripe.scheduleChange(input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(network).toHaveBeenCalledTimes(5);
  });
});
