import { Test, type TestingModule } from '@nestjs/testing';
import type { AdminBenefit, WriteBenefitBody } from '@vozzify/contracts';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { AdminBenefitsRepository } from './admin-benefits.repository.js';
import { AdminBenefitsService } from './admin-benefits.service.js';

const body: WriteBenefitBody = {
  copy: {
    en: { name: 'Cloud', description: 'Cloud recordings' },
    'pt-BR': { name: 'Cloud PT', description: 'Localized description' },
  },
  status: 'coming-soon',
};
const stored: AdminBenefit = { id: 'cloud', ...body, plans: [] };
const plan = { id: 'pro', copy: body.copy, benefitIds: ['cloud'] };
const repository = {
  listBenefits: vi.fn(),
  listPlans: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  lockPlan: vi.fn(),
  existingBenefits: vi.fn(),
  setPlanBenefits: vi.fn(),
};
const revalidation = { revalidate: vi.fn() };

describe('AdminBenefitsService', () => {
  let service: AdminBenefitsService;
  let moduleRef: TestingModule;
  beforeEach(async () => {
    vi.resetAllMocks();
    repository.listBenefits.mockResolvedValue([stored]);
    repository.listPlans.mockResolvedValue([plan]);
    repository.create.mockResolvedValue({ id: 'cloud' });
    repository.update.mockResolvedValue({ id: 'cloud' });
    repository.remove.mockResolvedValue({ id: 'cloud' });
    repository.lockPlan.mockResolvedValue({ id: 'pro' });
    repository.existingBenefits.mockResolvedValue([{ id: 'cloud' }]);
    const { db, pool } = fakeTransactionalDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        AdminBenefitsService,
        { provide: AdminBenefitsRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(AdminBenefitsService);
  });
  afterEach(async () => {
    await moduleRef.close();
  });

  it('reads the shared catalog and fails clearly on a missing benefit', async () => {
    expect(await service.list()).toEqual([stored]);
    expect(await service.get('cloud')).toEqual(stored);
    await expect(service.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  it('revalidates both public locales after every successful mutation', async () => {
    expect(await service.create(body)).toEqual(stored);
    expect(await service.update('cloud', body)).toEqual(stored);
    await service.remove('cloud');
    expect(await service.setPlanBenefits('pro', ['cloud'])).toEqual(plan);
    expect(revalidation.revalidate.mock.calls).toEqual(
      Array.from({ length: 4 }, () => [['plans', 'plans:en', 'plans:pt-BR']]),
    );
  });
  it('does not announce writes that failed or changed no resource', async () => {
    repository.create.mockResolvedValue(undefined);
    await expect(service.create(body)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
    repository.update.mockResolvedValue(undefined);
    await expect(service.update('cloud', body)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    repository.remove.mockResolvedValue(undefined);
    await expect(service.remove('cloud')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
  it('refuses missing plans and benefits before replacing valid associations', async () => {
    repository.lockPlan.mockResolvedValue(undefined);
    await expect(
      service.setPlanBenefits('missing', ['cloud']),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    repository.lockPlan.mockResolvedValue({ id: 'pro' });
    repository.existingBenefits.mockResolvedValue([]);
    await expect(
      service.setPlanBenefits('pro', ['missing']),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(repository.setPlanBenefits).not.toHaveBeenCalled();
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
  it('reports an underlying write failure without showing success', async () => {
    repository.setPlanBenefits.mockRejectedValue(
      new Error('Database unavailable'),
    );
    await expect(service.setPlanBenefits('pro', ['cloud'])).rejects.toThrow(
      'Database unavailable',
    );
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
  it('reports a plan removed after the replacement instead of returning an invalid response', async () => {
    repository.listPlans.mockResolvedValue([]);
    await expect(
      service.setPlanBenefits('pro', ['cloud']),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
