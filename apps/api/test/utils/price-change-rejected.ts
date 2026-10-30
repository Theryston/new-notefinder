import { subscriptionPriceChanges } from '../../src/database/schema/subscriptions.js';
import { PriceChangesService } from '../../src/modules/plans/price-changes.service.js';
import type { createAuthClient } from './auth.js';
import type { TestApp } from './create-test-app.js';

export async function checkRejectedRetry(input: {
  app: TestApp;
  admin: ReturnType<typeof createAuthClient>;
  email: { send: ReturnType<typeof vi.fn> };
  setDelivery: (value: { state: 'missing' | 'rejected' }) => void;
}) {
  const { app, admin, email, setDelivery } = input;
  const worker = app.app.get(PriceChangesService);
  await worker.processPending();
  setDelivery({ state: 'rejected' });
  await worker.processPending();
  await app.db.update(subscriptionPriceChanges).set({
    noticeStartedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
  });
  await worker.processPending();
  await admin.post('/v1/admin/plans/pro/price-changes/retry').expect(201);
  setDelivery({ state: 'missing' });
  await worker.processPending();
  const rows = await app.db.select().from(subscriptionPriceChanges);
  expect(rows[0]).toMatchObject({ noticeAttempt: 1, noticeStatus: 'sending' });
  expect(email.send).toHaveBeenCalledTimes(2);
}
