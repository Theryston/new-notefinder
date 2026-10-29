import { parseEnv } from '../../config/env.js';
import { StripeBillingService } from './stripe-billing.service.js';

const env = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/test',
  REDIS_URL: 'redis://localhost',
  STRIPE_SECRET_KEY: 'sk_test_unit',
});
const start = Math.floor(Date.now() / 1000);
const input = {
  id: 'change',
  subscription: 'sub_test',
  schedule: null,
  currentPrice: 'price_current',
  nextPrice: 'price_next',
  nextCycle: 'annual' as const,
  previousPrice: null,
  previousCycle: null,
  start,
  end: start + 3600,
};
const subscription = {
  id: 'sub_test',
  livemode: false,
  customer: 'cus_test',
  status: 'active',
  currency: 'usd',
  cancel_at_period_end: false,
  latest_invoice: { status: 'paid', amount_paid: 350 },
  items: {
    data: [
      {
        price: { id: 'price_current', unit_amount: 350, currency: 'usd' },
        current_period_start: start,
        current_period_end: start + 3600,
      },
    ],
  },
};

describe('Stripe subscription scheduling', () => {
  const network = vi.fn<typeof fetch>();
  beforeEach(() => {
    network.mockReset();
    vi.stubGlobal('fetch', network);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('preserves the current price until period end without proration', async () => {
    network
      .mockResolvedValueOnce(Response.json(subscription))
      .mockResolvedValueOnce(
        Response.json({ id: 'sched_test', livemode: false }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'sched_test',
          livemode: false,
          subscription: 'sub_test',
          status: 'active',
          phases: [
            {
              start_date: start,
              end_date: start + 3600,
              items: [{ price: 'price_current', quantity: 1 }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'sched_test',
          livemode: false,
          subscription: 'sub_test',
          status: 'active',
          phases: [
            {
              start_date: start,
              end_date: start + 3600,
              items: [{ price: 'price_current', quantity: 1 }],
            },
            {
              start_date: start + 3600,
              end_date: Math.floor(
                new Date((start + 3600) * 1000).setUTCFullYear(
                  new Date((start + 3600) * 1000).getUTCFullYear() + 1,
                ) / 1000,
              ),
              items: [{ price: 'price_next', quantity: 1 }],
            },
          ],
        }),
      );
    const result = await new StripeBillingService(env).scheduleChange(input);
    expect(result).toBe('sched_test');
    const params = new URLSearchParams(
      String(network.mock.calls[3]?.[1]?.body),
    );
    expect(params.get('phases[0][items][0][price]')).toBe('price_current');
    expect(params.get('phases[0][end_date]')).toBe(String(input.end));
    expect(params.get('phases[1][items][0][price]')).toBe('price_next');
    expect(params.get('proration_behavior')).toBe('none');
  });
  it('refuses to schedule when Stripe reports a cancellation after local reservation', async () => {
    network.mockResolvedValueOnce(
      Response.json({ ...subscription, cancel_at_period_end: true }),
    );
    await expect(
      new StripeBillingService(env).scheduleChange(input),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(network).toHaveBeenCalledTimes(1);
  });
  it('does not erase unrecognised provider schedule terms', async () => {
    network
      .mockResolvedValueOnce(Response.json(subscription))
      .mockResolvedValueOnce(
        Response.json({
          id: 'sched_test',
          livemode: false,
          subscription: 'sub_test',
          status: 'active',
          phases: [
            {
              start_date: start,
              end_date: start + 3600,
              discounts: [{ coupon: 'coupon_unexpected' }],
              items: [{ price: 'price_current', quantity: 1 }],
            },
          ],
        }),
      );
    await expect(
      new StripeBillingService(env).scheduleChange({
        ...input,
        schedule: 'sched_test',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('does not overwrite a future phase with an unexpected duration', async () => {
    network
      .mockResolvedValueOnce(Response.json(subscription))
      .mockResolvedValueOnce(
        Response.json({
          id: 'sched_test',
          livemode: false,
          subscription: 'sub_test',
          status: 'active',
          phases: [
            {
              start_date: start,
              end_date: start + 3600,
              items: [{ price: 'price_current', quantity: 1 }],
            },
            {
              start_date: start + 3600,
              end_date: start + 7200,
              items: [{ price: 'price_prior', quantity: 1 }],
            },
          ],
        }),
      );
    await expect(
      new StripeBillingService(env).scheduleChange({
        ...input,
        schedule: 'sched_test',
        previousPrice: 'price_prior',
        previousCycle: 'monthly',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(network).toHaveBeenCalledTimes(2);
  });
});
