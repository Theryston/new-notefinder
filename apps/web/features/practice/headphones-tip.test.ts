import { describe, expect, it, vi } from 'vitest';

import { takeHeadphonesTip } from './headphones-tip';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('takeHeadphonesTip', () => {
  it('shows the tip the first time only', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(takeHeadphonesTip()).toBe(true);
    expect(takeHeadphonesTip()).toBe(false);
  });

  it('shows the tip when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(takeHeadphonesTip()).toBe(true);
  });
});
