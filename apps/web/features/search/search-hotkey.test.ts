import { describe, expect, it } from 'vitest';

import { isSearchHotkey } from './search-hotkey';

const key = (overrides: Partial<Parameters<typeof isSearchHotkey>[0]>) => ({
  key: 'k',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  defaultPrevented: false,
  repeat: false,
  ...overrides,
});

describe('isSearchHotkey', () => {
  it('matches ⌘K and Ctrl K, in either case', () => {
    expect(isSearchHotkey(key({ metaKey: true }))).toBe(true);
    expect(isSearchHotkey(key({ ctrlKey: true }))).toBe(true);
    expect(isSearchHotkey(key({ ctrlKey: true, key: 'K' }))).toBe(true);
  });

  it('ignores K without a modifier or with Alt', () => {
    expect(isSearchHotkey(key({}))).toBe(false);
    expect(isSearchHotkey(key({ metaKey: true, altKey: true }))).toBe(false);
  });

  it('ignores other keys', () => {
    expect(isSearchHotkey(key({ metaKey: true, key: 'j' }))).toBe(false);
  });

  it('ignores handled and repeated presses', () => {
    expect(isSearchHotkey(key({ metaKey: true, defaultPrevented: true }))).toBe(
      false,
    );
    expect(isSearchHotkey(key({ metaKey: true, repeat: true }))).toBe(false);
  });
});
