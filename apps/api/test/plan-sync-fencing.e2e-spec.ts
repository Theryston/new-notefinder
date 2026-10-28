import type {
  LocalizedCatalogCopy,
  SaveAdminPlanBody,
} from '@notefinder/contracts';
import { eq, sql } from 'drizzle-orm';
import { planSyncOperations } from '../src/database/schema/plans.js';
import { StripeCatalogService } from '../src/integrations/stripe/stripe-catalog.service.js';
import { createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

const change = (): SaveAdminPlanBody => ({
  operationId: crypto.randomUUID(),
  copy: {
    en: { name: 'Studio A', description: 'Initial offer.' },
    'pt-BR': { name: 'Studio A BR', description: 'Localized initial offer.' },
  },
  displayOrder: 1,
  published: true,
  saleEnabled: true,
  enabledCycles: ['monthly'],
  prices: [
    { cycle: 'monthly', currency: 'BRL', amount: 2990 },
    { cycle: 'monthly', currency: 'USD', amount: 500 },
  ],
});

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Plan synchronization claim fencing (e2e)', () => {
  let app: TestApp;
  const stripe = { syncProduct: vi.fn(), ensurePrice: vi.fn() };
  beforeAll(async () => {
    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(StripeCatalogService).useValue(stripe),
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(app.db);
    stripe.syncProduct.mockReset().mockResolvedValue('prod_studio');
    stripe.ensurePrice
      .mockReset()
      .mockImplementation(
        async (input: { key: string }) => `price_${input.key}`,
      );
  });
  it.each(['success', 'failure'] as const)(
    'rejects stale %s after a replacement claim and a newer edit finish',
    async (outcome) => {
      const client = createAuthClient(app);
      const user = await createUser(app.db, { role: 'ADMIN' });
      await createCredentialAccount(app.db, user);
      await signIn(client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      const input = change();
      const planId = `plan-${input.operationId}`;
      const started = deferred();
      const resume = deferred();
      stripe.ensurePrice.mockImplementationOnce(
        async (price: { key: string }) => {
          started.resolve();
          await resume.promise;
          if (outcome === 'failure') throw new Error('Old worker failed');
          return `price_${price.key}`;
        },
      );
      const original = client
        .post('/v1/admin/plans')
        .send(input)
        .then((response) => response);
      await started.promise;
      await app.db
        .update(planSyncOperations)
        .set({ leaseUntil: new Date(0) })
        .where(eq(planSyncOperations.id, input.operationId));
      await client.post('/v1/admin/plans').send(input).expect(201);
      const newer = {
        ...change(),
        copy: {
          ...input.copy,
          en: { name: 'Studio B', description: 'Replacement offer.' },
        },
        displayOrder: 99,
        prices: input.prices.map((price) => ({
          ...price,
          amount: price.amount + 100,
        })),
      };
      await client.put(`/v1/admin/plans/${planId}`).send(newer).expect(200);
      resume.resolve();
      const originalResponse = await original;
      const catalog = await client.get('/v1/admin/plans').expect(200);
      expect(catalog.body.plans[0]).toMatchObject({
        copy: newer.copy,
        displayOrder: 99,
        prices: newer.prices,
        pendingOperation: null,
        syncStatus: 'synced',
      });
      const operations = await app.db
        .select({
          id: planSyncOperations.id,
          status: planSyncOperations.status,
        })
        .from(planSyncOperations);
      expect(operations).toEqual(
        expect.arrayContaining([
          { id: input.operationId, status: 'synced' },
          { id: newer.operationId, status: 'synced' },
        ]),
      );
      expect(originalResponse.status).toBe(409);
      const publicCatalog = await app.http.get('/v1/plans').expect(200);
      expect(publicCatalog.body.plans[0]).toMatchObject({
        name: 'Studio B',
        offers: [{ amount: 600 }],
      });
    },
  );
  it.each(['success', 'failure'] as const)(
    'preserves the replacement lease when an old claim returns %s',
    async (outcome) => {
      const client = createAuthClient(app);
      const user = await createUser(app.db, { role: 'ADMIN' });
      await createCredentialAccount(app.db, user);
      await signIn(client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      const input = change();
      const oldStarted = deferred();
      const newStarted = deferred();
      const resumeOld = deferred();
      const resumeNew = deferred();
      stripe.ensurePrice
        .mockImplementationOnce(async (price: { key: string }) => {
          oldStarted.resolve();
          await resumeOld.promise;
          if (outcome === 'failure')
            throw new Error('Obsolete network failure');
          return `price_${price.key}`;
        })
        .mockImplementationOnce(async (price: { key: string }) => {
          newStarted.resolve();
          await resumeNew.promise;
          return `price_${price.key}`;
        });
      const original = client
        .post('/v1/admin/plans')
        .send(input)
        .then((response) => response);
      await oldStarted.promise;
      await app.db
        .update(planSyncOperations)
        .set({ leaseUntil: new Date(0) })
        .where(eq(planSyncOperations.id, input.operationId));
      const retry = client
        .post('/v1/admin/plans')
        .send(input)
        .then((response) => response);
      await newStarted.promise;
      resumeOld.resolve();
      expect((await original).status).toBe(409);
      const pending = await client.get('/v1/admin/plans').expect(200);
      expect(pending.body.plans[0]).toMatchObject({
        syncStatus: 'pending',
        pendingOperation: input,
        published: false,
      });
      resumeNew.resolve();
      expect((await retry).status).toBe(201);
      expect(
        (await client.get('/v1/admin/plans').expect(200)).body.plans[0],
      ).toMatchObject({
        syncStatus: 'synced',
        pendingOperation: null,
        published: true,
      });
    },
  );
  it('serializes mutable provider copy with a checked plan claim', async () => {
    const client = createAuthClient(app);
    const user = await createUser(app.db, { role: 'ADMIN' });
    await createCredentialAccount(app.db, user);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    const input = change();
    const planId = `plan-${input.operationId}`;
    const started = deferred();
    const resume = deferred();
    let providerCopy: LocalizedCatalogCopy | undefined;
    let first = true;
    stripe.syncProduct.mockImplementation(
      async (request: { copy: LocalizedCatalogCopy }) => {
        if (first) {
          first = false;
          started.resolve();
          await resume.promise;
        }
        providerCopy = request.copy;
        return 'prod_studio';
      },
    );
    const original = client
      .post('/v1/admin/plans')
      .send(input)
      .then((response) => response);
    await started.promise;
    await app.db
      .update(planSyncOperations)
      .set({ leaseUntil: new Date(0) })
      .where(eq(planSyncOperations.id, input.operationId));
    try {
      await expect(
        app.db.execute(
          sql`select id from plans where id = ${planId} for update nowait`,
        ),
      ).rejects.toMatchObject({ cause: { code: '55P03' } });
    } finally {
      resume.resolve();
    }
    expect((await original).status).toBe(409);
    await client.post('/v1/admin/plans').send(input).expect(201);
    const newer = {
      ...input,
      operationId: crypto.randomUUID(),
      copy: {
        ...input.copy,
        en: {
          name: 'Studio B',
          description: 'The confirmed provider description.',
        },
      },
    };
    await client.put(`/v1/admin/plans/${planId}`).send(newer).expect(200);
    expect(providerCopy).toEqual(newer.copy);
    expect(
      (await app.http.get('/v1/plans').expect(200)).body.plans[0],
    ).toMatchObject(newer.copy.en);
  });
});
