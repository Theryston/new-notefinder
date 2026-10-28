import { Test } from '@nestjs/testing';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

type Record = Awaited<ReturnType<PlansRepository['findPublished']>>[number];
const record = (): Record => ({
  id: 'studio',
  kind: 'paid',
  copy: {
    en: { name: 'Studio', description: 'Practice tools.' },
    'pt-BR': { name: 'Studio BR', description: 'Localized tools.' },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  displayOrder: 1,
  published: true,
  trialDays: 0,
  enabledCycles: ['monthly'],
  saleEnabled: true,
  contractingEnabled: true,
  benefits: [],
  prices: (['BRL', 'USD'] as const).map((currency) => ({
    id: currency,
    planId: 'studio',
    currency,
    cycle: 'monthly',
    amount: 500,
    current: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    stripePriceId: `price_${currency}`,
  })),
});

describe('Public plan sale availability', () => {
  const repository = { findPublished: vi.fn() };
  let service: PlansService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PlansRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(PlansService);
  });
  it('offers new contracting only for globally enabled synchronized offers', async () => {
    repository.findPublished.mockResolvedValue([record()]);
    expect((await service.getCatalog('en')).plans[0]?.saleAvailable).toBe(true);
  });
  it.each(['global', 'plan', 'provider', 'currency', 'cycle', 'free'] as const)(
    'withholds sales with unavailable %s',
    async (missing) => {
      const row = record();
      if (missing === 'global') row.contractingEnabled = false;
      if (missing === 'plan') row.saleEnabled = false;
      if (missing === 'provider')
        row.prices = row.prices.map((price) => ({
          ...price,
          stripePriceId: null,
        }));
      if (missing === 'currency')
        row.prices = row.prices.filter((price) => price.currency !== 'BRL');
      if (missing === 'cycle') row.enabledCycles = [];
      if (missing === 'free') row.kind = 'free';
      repository.findPublished.mockResolvedValue([row]);
      expect((await service.getCatalog('en')).plans[0]?.saleAvailable).toBe(
        false,
      );
    },
  );
});
