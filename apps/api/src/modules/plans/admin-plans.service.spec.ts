import { Test, type TestingModule } from '@nestjs/testing';
import type { SaveAdminPlanBody } from '@vozzify/contracts';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { StripeCatalogService } from '../../integrations/stripe/stripe-catalog.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { AdminPlansService } from './admin-plans.service.js';
import { PlansRepository } from './plans.repository.js';

const input = (): SaveAdminPlanBody => ({
  operationId: '92469253-c257-4b28-a554-e69eb547357c',
  copy: {
    en: { name: 'Studio', description: 'Studio tools.' },
    'pt-BR': { name: 'Studio BR', description: 'Localized tools.' },
  },
  displayOrder: 1,
  published: true,
  saleEnabled: true,
  enabledCycles: ['monthly'],
  prices: [
    { cycle: 'monthly', currency: 'USD', amount: 500 },
    { cycle: 'monthly', currency: 'BRL', amount: 2990 },
  ],
});
const row = () => ({
  id: 'studio',
  kind: 'paid',
  ...input(),
  pendingSyncId: null,
  prices: input().prices,
});
const repository = {
  list: vi.fn(),
  contractingEnabled: vi.fn(),
  setContracting: vi.fn(),
  createDraft: vi.fn(),
  find: vi.fn(),
  lockOperation: vi.fn(),
  operation: vi.fn(),
  claim: vi.fn(),
  ownsLease: vi.fn(),
  setProduct: vi.fn(),
  currentPrice: vi.fn(),
  stagedPrice: vi.fn(),
  stagePrice: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
};
const stripe = { syncProduct: vi.fn(), ensurePrice: vi.fn() };
const revalidation = { revalidate: vi.fn() };

describe('Admin plan synchronization policy', () => {
  let service: AdminPlansService;
  let module: TestingModule;
  beforeEach(async () => {
    vi.resetAllMocks();
    repository.list.mockResolvedValue([row()]);
    repository.find.mockResolvedValue(row());
    repository.ownsLease.mockResolvedValue(true);
    repository.contractingEnabled.mockResolvedValue(false);
    stripe.syncProduct.mockResolvedValue('prod_studio');
    stripe.ensurePrice.mockResolvedValue('price_synced');
    const { db, pool } = fakeTransactionalDatabase();
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        AdminPlansService,
        { provide: PlansRepository, useValue: repository },
        { provide: StripeCatalogService, useValue: stripe },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    })
      .overrideProvider(DATABASE)
      .useValue(db)
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .compile();
    service = module.get(AdminPlansService);
  });
  afterEach(async () => {
    await module.close();
  });
  it('publishes a saved price set only after provider confirmation', async () => {
    expect(await service.save('studio', input())).toMatchObject({
      id: 'studio',
      syncStatus: 'synced',
      pendingOperation: null,
    });
    expect(repository.complete).toHaveBeenCalledWith('studio', input(), [
      `${input().operationId}-monthly-USD`,
      `${input().operationId}-monthly-BRL`,
    ]);
    expect(revalidation.revalidate).toHaveBeenCalledWith(['plans']);
  });
  it('uses a stable identity for retried creations', async () => {
    repository.list.mockResolvedValue([
      { ...row(), id: `plan-${input().operationId}` },
    ]);
    await service.create(input());
    expect(repository.createDraft).toHaveBeenCalledWith(
      `plan-${input().operationId}`,
      input(),
    );
  });
  it('keeps an interrupted change recoverable without publishing it', async () => {
    stripe.ensurePrice.mockRejectedValueOnce(new Error('Unreachable'));
    await expect(service.save('studio', input())).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith(input().operationId);
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
  it('reuses unchanged versions and already-staged successful prices', async () => {
    repository.currentPrice.mockResolvedValueOnce({ id: 'current' });
    repository.stagedPrice.mockResolvedValueOnce({ id: 'staged' });
    await service.save('studio', input());
    expect(stripe.ensurePrice).not.toHaveBeenCalled();
    expect(repository.complete).toHaveBeenCalledWith('studio', input(), [
      'current',
      `${input().operationId}-monthly-BRL`,
    ]);
  });
  it('returns completed operations without repeating provider writes', async () => {
    repository.operation.mockResolvedValue({
      planId: 'studio',
      body: input(),
      status: 'synced',
    });
    await service.save('studio', input());
    expect(stripe.syncProduct).not.toHaveBeenCalled();
    expect(repository.claim).not.toHaveBeenCalled();
  });
  it.each([
    { planId: 'other', body: input(), status: 'failed' },
    {
      planId: 'studio',
      body: { ...input(), displayOrder: 100 },
      status: 'failed',
    },
  ])(
    'rejects another change using the same operation identity',
    async (operation) => {
      repository.operation.mockResolvedValue(operation);
      await expect(service.save('studio', input())).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      expect(stripe.syncProduct).not.toHaveBeenCalled();
    },
  );
  it('rejects a competing change and a live retry lease', async () => {
    repository.find.mockResolvedValue({ ...row(), pendingSyncId: 'other' });
    await expect(service.save('studio', input())).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    repository.find.mockResolvedValue({
      ...row(),
      pendingSyncId: input().operationId,
    });
    repository.operation.mockResolvedValue({
      planId: 'studio',
      body: input(),
      status: 'pending',
      leaseUntil: new Date(Date.now() + 60_000),
    });
    await expect(service.save('studio', input())).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
  it('recovers an expired lease', async () => {
    repository.operation.mockResolvedValue({
      planId: 'studio',
      body: input(),
      status: 'pending',
      leaseUntil: new Date(0),
    });
    await expect(service.save('studio', input())).resolves.toMatchObject({
      syncStatus: 'synced',
    });
  });
  it('rejects missing and Free plans before contacting Stripe', async () => {
    repository.find
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ...row(), kind: 'free' });
    await expect(service.save('missing', input())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.save('free', input())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(stripe.syncProduct).not.toHaveBeenCalled();
  });
  it('reports a resulting plan that cannot be read', async () => {
    repository.list.mockResolvedValue([]);
    await expect(service.save('studio', input())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  it('stores contracting controls and exposes pending sync state', async () => {
    repository.list.mockResolvedValue([
      { ...row(), operation: { status: 'failed', body: input() } },
    ]);
    const catalog = await service.setContracting(true);
    expect(repository.setContracting).toHaveBeenCalledWith(true);
    expect(catalog.plans[0]).toMatchObject({
      syncStatus: 'failed',
      pendingOperation: input(),
    });
  });
  it('rechecks completed operation state after taking the plan lock', async () => {
    repository.operation
      .mockResolvedValueOnce({
        planId: 'studio',
        body: input(),
        status: 'pending',
        leaseUntil: new Date(0),
      })
      .mockResolvedValue({
        planId: 'studio',
        body: input(),
        status: 'synced',
        leaseUntil: null,
      });
    await service.save('studio', input());
    expect(repository.claim).not.toHaveBeenCalled();
    expect(stripe.syncProduct).not.toHaveBeenCalled();
  });
});

describe('Obsolete synchronization workers', () => {
  it.each(['before-provider', 'before-publish', 'provider-failure'] as const)(
    'does not change state after losing ownership %s',
    async (when) => {
      const repo = {
        ...repository,
        list: vi.fn().mockResolvedValue([row()]),
        find: vi.fn().mockResolvedValue(row()),
        operation: vi.fn().mockResolvedValue(undefined),
        ownsLease: vi.fn().mockResolvedValue(false),
        currentPrice: vi.fn().mockResolvedValue(undefined),
        stagedPrice: vi.fn().mockResolvedValue(undefined),
        complete: vi.fn(),
        fail: vi.fn(),
        setProduct: vi.fn(),
      };
      const provider = {
        syncProduct: vi.fn().mockResolvedValue('prod_studio'),
        ensurePrice: vi.fn().mockResolvedValue('price_studio'),
      };
      const { db, pool } = fakeTransactionalDatabase();
      const module = await Test.createTestingModule({
        imports: [DatabaseModule],
        providers: [
          AdminPlansService,
          { provide: PlansRepository, useValue: repo },
          { provide: StripeCatalogService, useValue: provider },
          { provide: WebRevalidationService, useValue: revalidation },
        ],
      })
        .overrideProvider(DATABASE)
        .useValue(db)
        .overrideProvider(DATABASE_POOL)
        .useValue(pool)
        .compile();
      const service = module.get(AdminPlansService);
      if (when !== 'before-provider')
        repo.ownsLease.mockResolvedValueOnce(true);
      if (when === 'provider-failure')
        provider.ensurePrice.mockRejectedValueOnce(
          new Error('Obsolete provider failure'),
        );
      await expect(service.save('studio', input())).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      if (when === 'before-provider')
        expect(provider.syncProduct).not.toHaveBeenCalled();
      expect(repo.complete).not.toHaveBeenCalled();
      expect(repo.fail).not.toHaveBeenCalled();
      expect(repo.setProduct).not.toHaveBeenCalled();
      await module.close();
    },
  );
});
