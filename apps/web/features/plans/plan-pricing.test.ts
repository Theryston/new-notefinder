import type { PlanOffer } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';
import {
  annualSavingsMonths,
  monthlyPlanAmount,
  selectedPlanOffer,
} from './plan-pricing';

const monthly: PlanOffer = { id: 'monthly', cycle: 'monthly', amount: 1990 };
const annual: PlanOffer = { id: 'annual', cycle: 'annual', amount: 19900 };

describe('plan pricing', () => {
  it('keeps the selected configured cycle and falls back to the only offer', () => {
    expect(selectedPlanOffer([monthly, annual], 'annual')).toBe(annual);
    expect(selectedPlanOffer([annual], 'monthly')).toBe(annual);
    expect(selectedPlanOffer([], 'monthly')).toBeUndefined();
  });
  it('shows an annual monthly equivalent without changing the billed total', () => {
    expect(monthlyPlanAmount(monthly)).toBe(1990);
    expect(monthlyPlanAmount(annual)).toBe(1658);
    expect(annual.amount).toBe(19900);
    expect(monthlyPlanAmount({ ...annual, amount: 3500 })).toBe(292);
    expect(monthlyPlanAmount({ ...annual, amount: 4800 })).toBe(400);
  });
  it('derives whole months of savings from configured prices', () => {
    expect(annualSavingsMonths([monthly, annual])).toBe(2);
    expect(
      annualSavingsMonths([
        { ...monthly, amount: 350 },
        { ...annual, amount: 3500 },
      ]),
    ).toBe(2);
    expect(annualSavingsMonths([monthly, { ...annual, amount: 21000 }])).toBe(
      1,
    );
  });
  it('does not advertise savings for missing cycles or non-discounted prices', () => {
    expect(annualSavingsMonths([])).toBe(0);
    expect(annualSavingsMonths([monthly])).toBe(0);
    expect(annualSavingsMonths([annual])).toBe(0);
    expect(annualSavingsMonths([monthly, { ...annual, amount: 23880 }])).toBe(
      0,
    );
    expect(annualSavingsMonths([monthly, { ...annual, amount: 25000 }])).toBe(
      0,
    );
  });
});
