export const billingKeys = {
  changeOffers: (currencyLocale: string, locale: string) =>
    ['billing', 'change-offers', currencyLocale, locale] as const,
  subscription: (userId: string, locale: string) =>
    ['billing', 'subscription', userId, locale] as const,
};
