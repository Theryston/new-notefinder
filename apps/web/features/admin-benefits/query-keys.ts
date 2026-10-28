export const benefitKeys = {
  all: ['admin-benefits'] as const,
  catalog: () => [...benefitKeys.all, 'catalog'] as const,
  plans: () => [...benefitKeys.all, 'plans'] as const,
  deletionImpact: (benefitId: string) =>
    [...benefitKeys.all, 'deletion-impact', benefitId] as const,
};
