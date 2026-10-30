import { describe, expect, it } from 'vitest';
import { firstEligibleRenewal } from './price-change-renewal.js';

const date = (value: string) => new Date(value);

describe('price-change renewal', () => {
  it('accepts a renewal exactly 30 days after successful dispatch', () => {
    expect(
      firstEligibleRenewal({
        noticeAt: date('2026-01-01T10:00:00Z'),
        nextRenewal: date('2026-01-31T10:00:00Z'),
        anchor: date('2025-12-31T10:00:00Z'),
        cycle: 'monthly',
      }).toISOString(),
    ).toBe('2026-01-31T10:00:00.000Z');
  });

  it('defers an imminent monthly renewal using the original billing anchor', () => {
    expect(
      firstEligibleRenewal({
        noticeAt: date('2026-02-01T10:00:01Z'),
        nextRenewal: date('2026-02-28T10:00:00Z'),
        anchor: date('2026-01-31T10:00:00Z'),
        cycle: 'monthly',
      }).toISOString(),
    ).toBe('2026-03-31T10:00:00.000Z');
  });

  it('defers an imminent annual renewal and preserves leap-day anchoring', () => {
    expect(
      firstEligibleRenewal({
        noticeAt: date('2027-02-10T10:00:00Z'),
        nextRenewal: date('2027-02-28T10:00:00Z'),
        anchor: date('2024-02-29T10:00:00Z'),
        cycle: 'annual',
      }).toISOString(),
    ).toBe('2028-02-29T10:00:00.000Z');
  });
});
