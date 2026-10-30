export const priceChangeBody = () => ({
  operationId: crypto.randomUUID(),
  copy: {
    en: { name: 'Pro', description: 'Support singing.' },
    'pt-BR': { name: 'Pro', description: 'Localized singing support.' },
  },
  displayOrder: 0,
  published: true,
  saleEnabled: true,
  enabledCycles: ['monthly', 'annual'],
  prices: [
    { cycle: 'monthly', currency: 'BRL', amount: 1990 },
    { cycle: 'monthly', currency: 'USD', amount: 500 },
    { cycle: 'annual', currency: 'BRL', amount: 19900 },
    { cycle: 'annual', currency: 'USD', amount: 3500 },
  ],
});
