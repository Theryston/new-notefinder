import { describe, expect, it } from 'vitest';

import { type PinWindow, pinStatus } from './pin-status';

const windowOf = (
  startsAt: string | null,
  endsAt: string | null,
): PinWindow => ({
  startsAt,
  endsAt,
});

const NOW = new Date('2026-10-21T12:00:00.000Z');

describe('pinStatus', () => {
  it('is live for an indefinite pin', () => {
    expect(pinStatus(windowOf(null, null), NOW)).toBe('live');
  });

  it('is scheduled before the start, even with no end', () => {
    expect(pinStatus(windowOf('2026-10-22T00:00:00.000Z', null), NOW)).toBe(
      'scheduled',
    );
  });

  it('is live inside its window', () => {
    expect(
      pinStatus(
        windowOf('2026-10-20T00:00:00.000Z', '2026-10-22T00:00:00.000Z'),
        NOW,
      ),
    ).toBe('live');
  });

  it('is ended once the end passes', () => {
    expect(
      pinStatus(
        windowOf('2026-10-19T00:00:00.000Z', '2026-10-21T11:59:59.000Z'),
        NOW,
      ),
    ).toBe('ended');
  });

  it('is ended for a past window with no start', () => {
    expect(pinStatus(windowOf(null, '2026-10-21T11:59:59.000Z'), NOW)).toBe(
      'ended',
    );
  });

  it('is live exactly at the start and ended exactly at the end', () => {
    expect(pinStatus(windowOf(NOW.toISOString(), null), NOW)).toBe('live');
    expect(
      pinStatus(windowOf('2026-10-20T00:00:00.000Z', NOW.toISOString()), NOW),
    ).toBe('ended');
  });
});
