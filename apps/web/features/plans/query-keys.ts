export const billingKeys = {
  trialEligibility: (userId: string | undefined) =>
    ['billing', 'trial-eligibility', userId] as const,
  subscription: (userId: string, locale: string) =>
    ['billing', 'subscription', userId, locale] as const,
};
