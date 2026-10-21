import { describe, expect, it, vi } from 'vitest';
import { getOrCreateVisitorId, VISITOR_ID_KEY } from './visitor-id';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    stored: (key: string) => values.get(key),
  };
};

describe('getOrCreateVisitorId', () => {
  it('reuses the stored visitor id', () => {
    const browser = storage();
    browser.setItem(VISITOR_ID_KEY, 'visitor-1');

    expect(getOrCreateVisitorId(browser)).toBe('visitor-1');
    expect(browser.setItem).toHaveBeenCalledTimes(1);
  });

  it('creates and stores one when none is stored', () => {
    const browser = storage();

    const first = getOrCreateVisitorId(browser);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(browser.stored(VISITOR_ID_KEY)).toBe(first);

    expect(getOrCreateVisitorId(browser)).toBe(first);
  });
});
