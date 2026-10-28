export const billingKeys = {
  subscription: (userId: string, locale: string) =>
    ['billing', 'subscription', userId, locale] as const,
};
