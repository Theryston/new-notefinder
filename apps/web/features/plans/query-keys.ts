export const billingKeys = {
  changeOffers: (currencyLocale: string, locale: string) =>
    ['billing', 'change-offers', currencyLocale, locale] as const,
  trialEligibility: (userId: string | undefined) =>
    ['billing', 'trial-eligibility', userId] as const,
  subscription: (userId: string, locale: string) =>
    ['billing', 'subscription', userId, locale] as const,
};
