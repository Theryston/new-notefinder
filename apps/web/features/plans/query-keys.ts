export const billingKeys = {
  offer: (locale: string, planId: string, offerId: string) =>
    ['billing', 'offer', locale, planId, offerId] as const,
  subscription: (userId: string, locale: string) =>
    ['billing', 'subscription', userId, locale] as const,
};
