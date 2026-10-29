import { saveAdminPlanBodySchema } from '@vozzify/contracts';

describe('Plan trial configuration', () => {
  const plan = {
    operationId: 'a3ec84c8-a4e1-4c9c-b847-d67aa12f922a',
    copy: {
      en: { name: 'Pro', description: 'Support.' },
      'pt-BR': { name: 'Pro', description: 'Suporte.' },
    },
    displayOrder: 0,
    published: false,
    saleEnabled: false,
    enabledCycles: ['monthly', 'annual'],
    prices: [],
  };
  it.each([0, 14, 730])(
    'accepts %i days for both billing cycles',
    (trialDays) => {
      expect(
        saveAdminPlanBodySchema.parse({ ...plan, trialDays }).trialDays,
      ).toBe(trialDays);
    },
  );
  it.each([-1, 1.5, 731])('rejects unsupported duration %s', (trialDays) => {
    expect(
      saveAdminPlanBodySchema.safeParse({ ...plan, trialDays }).success,
    ).toBe(false);
  });
});
