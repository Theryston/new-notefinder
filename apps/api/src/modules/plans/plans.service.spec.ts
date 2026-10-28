import { Test } from '@nestjs/testing';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

type Record = Awaited<ReturnType<PlansRepository['findPublished']>>[number];
const now = new Date('2026-10-27T12:00:00Z');
const copy = {
  en: { name: 'Studio', description: 'Future singing tools.' },
  'pt-BR': { name: 'Studio BR', description: 'Localized singing tools.' },
};
const record = (): Record => ({
  id: 'studio',
  kind: 'paid',
  copy,
  displayOrder: 1,
  published: true,
  enabledCycles: ['monthly', 'annual'],
  trialDays: 0,
  createdAt: now,
  updatedAt: now,
  benefits: [
    {
      id: 'score',
      copy,
      status: 'coming-soon',
      createdAt: now,
      updatedAt: now,
    },
  ],
  prices: (
    [
      { id: 'month-usd', cycle: 'monthly', currency: 'USD', amount: 350 },
      { id: 'month-brl', cycle: 'monthly', currency: 'BRL', amount: 1990 },
      { id: 'year-usd', cycle: 'annual', currency: 'USD', amount: 3500 },
      { id: 'year-brl', cycle: 'annual', currency: 'BRL', amount: 19900 },
    ] as const
  ).map((price) => ({
    ...price,
    planId: 'studio',
    current: true,
    createdAt: now,
    updatedAt: now,
  })),
});

describe('PlansService', () => {
  const repository = {
    findPublished: vi.fn<PlansRepository['findPublished']>(),
  };
  let service: PlansService;

  beforeEach(async () => {
    repository.findPublished.mockResolvedValue([record()]);
    const module = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PlansRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(PlansService);
  });

  it('keeps independent prices tied to the interface locale', async () => {
    expect(await service.getCatalog('en')).toMatchObject({
      currency: 'USD',
      plans: [
        {
          name: 'Studio',
          offers: [{ amount: 350 }, { amount: 3500 }],
          benefits: [{ status: 'coming-soon' }],
        },
      ],
    });
    expect(await service.getCatalog('pt-BR')).toMatchObject({
      currency: 'BRL',
      plans: [
        { name: 'Studio BR', offers: [{ amount: 1990 }, { amount: 19900 }] },
      ],
    });
  });

  it('does not offer disabled cycles or incomplete currency pairs', async () => {
    const row = record();
    row.enabledCycles = ['annual'];
    row.prices = row.prices.filter((price) => price.id !== 'year-brl');
    repository.findPublished.mockResolvedValue([row]);
    expect((await service.getCatalog('en')).plans[0]?.offers).toEqual([]);
  });

  it('withholds nonpositive offers rather than substituting another currency', async () => {
    const row = record();
    row.prices = row.prices.map((price) => ({
      ...price,
      amount: price.id === 'month-brl' ? 0 : price.amount,
    }));
    repository.findPublished.mockResolvedValue([row]);
    expect(
      (await service.getCatalog('en')).plans[0]?.offers.map(
        (offer) => offer.cycle,
      ),
    ).toEqual(['annual']);
  });

  it('keeps Free without billable offers and omits hidden benefits', async () => {
    const row = record();
    row.kind = 'free';
    row.benefits = row.benefits.map((benefit) => ({
      ...benefit,
      status: 'hidden',
    }));
    repository.findPublished.mockResolvedValue([row]);
    expect((await service.getCatalog('en')).plans[0]).toMatchObject({
      kind: 'free',
      offers: [],
      benefits: [],
    });
  });

  it('refuses invalid localized content as a server serialization error', async () => {
    const row = record();
    row.copy = { ...copy, en: { name: ' ', description: 'Invalid name.' } };
    repository.findPublished.mockResolvedValue([row]);
    await expect(service.getCatalog('en')).rejects.toThrow(
      'Response does not match its contract schema',
    );
  });

  it('returns an empty catalog without inventing plans', async () => {
    repository.findPublished.mockResolvedValue([]);
    await expect(service.getCatalog('en')).resolves.toEqual({
      currency: 'USD',
      plans: [],
    });
  });
});
