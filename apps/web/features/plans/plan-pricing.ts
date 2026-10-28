import type { BillingCycle, PlanOffer } from '@notefinder/contracts';

const MONTHS_PER_YEAR = 12;

export function selectedPlanOffer(offers: PlanOffer[], cycle: BillingCycle) {
  return offers.find((offer) => offer.cycle === cycle) ?? offers[0];
}

export function monthlyPlanAmount(offer: PlanOffer) {
  return offer.cycle === 'annual'
    ? Math.round(offer.amount / MONTHS_PER_YEAR)
    : offer.amount;
}

export function annualSavingsMonths(offers: PlanOffer[]) {
  const monthly = offers.find((offer) => offer.cycle === 'monthly');
  const annual = offers.find((offer) => offer.cycle === 'annual');
  if (!monthly || !annual) return 0;
  return Math.max(
    0,
    Math.floor(
      (monthly.amount * MONTHS_PER_YEAR - annual.amount) / monthly.amount,
    ),
  );
}
