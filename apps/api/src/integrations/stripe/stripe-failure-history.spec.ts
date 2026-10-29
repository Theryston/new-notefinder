import { parseEnv } from '../../config/env.js';
import { StripeBillingService } from './stripe-billing.service.js';

const env = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/test',
  REDIS_URL: 'redis://localhost',
  STRIPE_SECRET_KEY: 'sk_test_unit',
});
const event = (id: string, created: number, invoice: string) => ({
  id,
  created,
  livemode: false,
  data: { object: { id: invoice, customer: 'cus_test' } },
});
describe('Stripe renewal failure history', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('finds the first matching failure across pages before accepting a later retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const now = Date.now() / 1000;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: [event('evt_retry', now - 60, 'in_test')],
          has_more: true,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [
            event('evt_other', now - 90, 'in_other'),
            event('evt_first', now - 120, 'in_test'),
          ],
          has_more: false,
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(
      await new StripeBillingService(env).firstInvoiceFailure({
        invoiceId: 'in_test',
        customer: 'cus_test',
        invoiceCreated: now - 3600,
        latestFailure: now - 60,
      }),
    ).toBe(now - 120);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('fails closed when history is unavailable or predates Stripe retention', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const now = Date.now() / 1000;
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [], has_more: false }));
    vi.stubGlobal('fetch', fetcher);
    const stripe = new StripeBillingService(env);
    await expect(
      stripe.firstInvoiceFailure({
        invoiceId: 'in_test',
        customer: 'cus_test',
        invoiceCreated: now - 3600,
        latestFailure: now,
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    await expect(
      stripe.firstInvoiceFailure({
        invoiceId: 'in_test',
        customer: 'cus_test',
        invoiceCreated: now - 31 * 86400,
        latestFailure: now,
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
  it('does not grant grace when the provider history exceeds the page bound', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const now = Date.now() / 1000;
    const fetcher = vi.fn().mockImplementation(async () =>
      Response.json({
        data: [event('evt_retry', now - 60, 'in_test')],
        has_more: true,
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new StripeBillingService(env).firstInvoiceFailure({
        invoiceId: 'in_test',
        customer: 'cus_test',
        invoiceCreated: now - 3600,
        latestFailure: now,
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(10);
  });
});
