import { Test, type TestingModule } from '@nestjs/testing';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { ENV, parseEnv } from '../../config/env.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { EmailService } from '../../integrations/email/email.service.js';
import { PriceNoticeReconciliation } from '../../integrations/email/price-notice-reconciliation.js';
import { StripeBillingService } from '../../integrations/stripe/stripe-billing.service.js';
import { PriceChangeNoticeService } from './price-change-notice.service.js';
import { PriceChangeReconcileService } from './price-change-reconcile.service.js';
import { PriceChangeRetryService } from './price-change-retry.service.js';
import { PriceChangeScheduleService } from './price-change-schedule.service.js';
import { PriceChangesRepository } from './price-changes.repository.js';
import { PriceChangesService } from './price-changes.service.js';
import { SubscriptionChangesService } from './subscription-changes.service.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

const DAY = 86400_000;
const env = parseEnv({
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  RESEND_API_KEY: 're_test',
});
const changes = {
  pending: vi.fn(),
  uncertain: vi.fn(),
  find: vi.fn(),
  earlier: vi.fn(),
  update: vi.fn(),
  saveCursor: vi.fn(),
  markNoticeFailure: vi.fn(),
  transitionNotice: vi.fn(),
  failedForPlan: vi.fn(),
};
const subscriptions = { lock: vi.fn(), change: vi.fn() };
const stripe = { getSubscription: vi.fn() };
const email = { send: vi.fn(), delivery: vi.fn(), retryDelivery: vi.fn() };
const scheduler = { reprice: vi.fn() };
const provider = { find: vi.fn() };

function record() {
  const end = Math.floor(Date.now() / 1000) * 1000 + 45 * DAY;
  return {
    change: {
      id: 'c1',
      noticeStatus: 'pending',
      scheduleStatus: 'pending',
      noticeAttempt: 0,
      oldPriceId: 'old',
      newPriceId: 'new',
      oldAmount: 350,
      newAmount: 500,
      effectiveAt: null,
      noticeStartedAt: null,
      noticeSentAt: null,
      noticeMessage: null,
      noticeHistory: [],
      reconcileCursor: null,
    },
    contract: {
      id: 'contract',
      userId: 'user',
      planId: 'pro',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      priceId: 'old',
      stripePriceId: 'price_old',
      stripeSubscriptionId: 'sub',
      providerStatus: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date(end - 30 * DAY),
      currentPeriodEnd: new Date(end),
    },
    price: {
      id: 'new',
      stripePriceId: 'price_new',
      planId: 'pro',
      cycle: 'monthly',
      currency: 'USD',
      amount: 500,
    },
    recipient: { email: 'singer@example.com', locale: 'en' },
  };
}

describe('price change notice workflow', () => {
  let module: TestingModule;
  let workflow: PriceChangesService;
  let retries: PriceChangeRetryService;
  let reconciliation: PriceChangeReconcileService;
  let row: ReturnType<typeof record>;
  beforeEach(async () => {
    vi.resetAllMocks();
    row = record();
    changes.pending.mockResolvedValue([
      { id: 'c1', userId: 'user', noticeAttempt: 0 },
    ]);
    changes.find.mockImplementation(async () => row);
    changes.earlier.mockResolvedValue(false);
    changes.update.mockImplementation(async (_id: string, values: object) =>
      Object.assign(row.change, values),
    );
    changes.transitionNotice.mockImplementation(
      async (
        _id: string,
        attempt: number,
        expected: string,
        status: string,
      ) => {
        if (
          row.change.noticeAttempt === attempt &&
          row.change.noticeStatus === expected
        )
          row.change.noticeStatus = status;
      },
    );
    subscriptions.change.mockResolvedValue(null);
    stripe.getSubscription.mockImplementation(async () => ({
      status: 'active',
      cancel_at_period_end: false,
      schedule: null,
      billing_cycle_anchor: Math.floor(
        row.contract.currentPeriodEnd.getTime() / 1000,
      ),
      items: {
        data: [
          {
            price: { id: 'price_old' },
            current_period_end: Math.floor(
              row.contract.currentPeriodEnd.getTime() / 1000,
            ),
          },
        ],
      },
    }));
    email.delivery.mockResolvedValue({ state: 'missing' });
    const { db, pool } = fakeTransactionalDatabase();
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        PriceChangesService,
        PriceChangeNoticeService,
        PriceChangeRetryService,
        PriceChangeScheduleService,
        PriceChangeReconcileService,
        { provide: ENV, useValue: env },
        { provide: PriceChangesRepository, useValue: changes },
        { provide: SubscriptionsRepository, useValue: subscriptions },
        { provide: StripeBillingService, useValue: stripe },
        { provide: EmailService, useValue: email },
        { provide: SubscriptionChangesService, useValue: scheduler },
        { provide: PriceNoticeReconciliation, useValue: provider },
      ],
    })
      .overrideProvider(DATABASE)
      .useValue(db)
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .compile();
    workflow = module.get(PriceChangesService);
    retries = module.get(PriceChangeRetryService);
    reconciliation = module.get(PriceChangeReconcileService);
  });
  afterEach(async () => {
    await module.close();
    vi.useRealTimers();
  });

  it('sends once, waits for accepted delivery, and schedules the announced renewal', async () => {
    await workflow.processPending();
    expect(row.change.noticeStatus).toBe('sending');
    expect(email.send).toHaveBeenCalledTimes(1);
    email.delivery.mockResolvedValue({ state: 'sent', sentAt: new Date() });
    await workflow.processPending();
    expect(row.change.noticeStatus).toBe('sent');
    expect(row.change.scheduleStatus).toBe('scheduled');
    expect(scheduler.reprice).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ id: 'c1', priceId: 'new' }),
    );
  });
  it('defers scheduling when the first renewal is too close', async () => {
    row.contract.currentPeriodEnd = new Date(
      Math.floor(Date.now() / 1000) * 1000 + 10 * DAY,
    );
    await workflow.processPending();
    email.delivery.mockResolvedValue({ state: 'sent', sentAt: new Date() });
    await workflow.processPending();
    expect(row.change.noticeStatus).toBe('sent');
    expect(scheduler.reprice).not.toHaveBeenCalled();
  });
  it.each([
    'canceled',
    'matching',
    'other-offer',
    'pending-user-change',
    'provider-schedule',
    'past-due',
  ])(
    'does not send when %s makes the contract ineligible',
    async (condition) => {
      if (condition === 'canceled') row.contract.providerStatus = 'canceled';
      if (condition === 'matching') row.contract.priceId = 'new';
      if (condition === 'other-offer') row.contract.planId = 'other';
      if (condition === 'pending-user-change')
        subscriptions.change.mockResolvedValue({
          change: { id: 'user-change' },
        });
      if (condition === 'provider-schedule')
        stripe.getSubscription.mockResolvedValue({
          status: 'active',
          schedule: 'other',
          items: { data: [] },
        });
      if (condition === 'past-due')
        stripe.getSubscription.mockResolvedValue({
          status: 'past_due',
          schedule: null,
          items: { data: [] },
        });
      await workflow.processPending();
      expect(email.send).not.toHaveBeenCalled();
      expect(scheduler.reprice).not.toHaveBeenCalled();
    },
  );
  it('reports an unrecognized provider schedule without overwriting it', async () => {
    stripe.getSubscription.mockResolvedValue({
      status: 'active',
      schedule: 'external',
      items: { data: [] },
    });
    await workflow.processPending();
    expect(row.change.scheduleStatus).toBe('failed');
    expect(email.send).not.toHaveBeenCalled();
    await retries.retry('c1', 'user');
    expect(row.change.scheduleStatus).toBe('pending');
  });
  it('reissues a corrected notice if confirmed delivery crosses its date boundary', async () => {
    await workflow.processPending();
    email.delivery.mockResolvedValue({
      state: 'sent',
      sentAt: new Date(Date.now() + 20 * DAY),
    });
    await workflow.processPending();
    expect(row.change.noticeStatus).toBe('pending');
    expect(row.change.noticeAttempt).toBe(1);
    expect(row.change.noticeHistory).toHaveLength(1);
    expect(scheduler.reprice).not.toHaveBeenCalled();
  });
  it('rejects an old delivery confirmation after a corrected notice has started', async () => {
    await workflow.processPending();
    Object.assign(row.change, { noticeAttempt: 1 });
    await module
      .get(PriceChangeNoticeService)
      .confirmNotice('c1', 'user', new Date(), 0);
    expect(row.change.noticeStatus).toBe('sending');
    expect(scheduler.reprice).not.toHaveBeenCalled();
  });
  it('marks failed delivery and retries the same provider job', async () => {
    await workflow.processPending();
    email.delivery.mockResolvedValue({ state: 'failed' });
    await workflow.processPending();
    expect(row.change.noticeStatus).toBe('failed');
    await retries.retry('c1', 'user');
    expect(row.change.noticeStatus).toBe('sending');
    expect(email.retryDelivery).toHaveBeenCalledWith('price-change-c1-0');
  });
  it('does not resend after the idempotency window and reconciles a verified notice', async () => {
    await workflow.processPending();
    Object.assign(row.change, {
      noticeStartedAt: new Date(Date.now() - 2 * DAY),
    });
    await workflow.processPending();
    expect(row.change.noticeStatus).toBe('uncertain');
    provider.find.mockResolvedValue({ found: true, cursor: null });
    changes.uncertain.mockResolvedValue([{ id: 'c1', userId: 'user' }]);
    await reconciliation.processPending();
    expect(row.change.noticeStatus).toBe('sent');
    expect(email.send).toHaveBeenCalledTimes(1);
  });
  it('exposes schedule failure and retries without another notice', async () => {
    await workflow.processPending();
    email.delivery.mockResolvedValue({ state: 'sent', sentAt: new Date() });
    scheduler.reprice.mockRejectedValueOnce(new Error('unavailable'));
    await workflow.processPending();
    expect(row.change.scheduleStatus).toBe('failed');
    await retries.retry('c1', 'user');
    await workflow.processPending();
    expect(row.change.scheduleStatus).toBe('scheduled');
    expect(email.send).toHaveBeenCalledTimes(1);
  });
});
