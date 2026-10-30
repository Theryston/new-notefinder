import type { BillingCycle } from '@vozzify/contracts';

const NOTICE_MS = 30 * 24 * 60 * 60 * 1000;

export function firstEligibleRenewal(input: {
  noticeAt: Date;
  nextRenewal: Date;
  anchor: Date;
  cycle: BillingCycle;
}): Date {
  const threshold = input.noticeAt.getTime() + NOTICE_MS;
  let renewal = new Date(input.nextRenewal);
  while (renewal.getTime() < threshold) {
    renewal = followingRenewal(renewal, input.anchor, input.cycle);
  }
  return renewal;
}

function followingRenewal(
  current: Date,
  anchor: Date,
  cycle: BillingCycle,
): Date {
  const next = new Date(current);
  next.setUTCDate(1);
  if (cycle === 'annual') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return next;
}
