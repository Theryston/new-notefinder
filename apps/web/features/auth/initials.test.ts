import { describe, expect, it } from 'vitest';

import { initials } from './initials';

describe('initials', () => {
  it('takes the first letter of the first and last names', () => {
    expect(initials('Ada Lovelace', 'ada')).toBe('AL');
    expect(initials('ada king lovelace', 'ada')).toBe('AL');
  });

  it('uses one letter for a single name', () => {
    expect(initials('Ada', 'ada')).toBe('A');
  });

  it('ignores extra whitespace', () => {
    expect(initials('  Ada   Lovelace  ', 'ada')).toBe('AL');
  });

  it('keeps accented and non-Latin letters whole', () => {
    expect(initials('Ícaro Ñúñez', 'x')).toBe('ÍÑ');
    expect(initials('😀 Smile', 'x')).toBe('😀S');
  });

  it('falls back to the first letter or digit of the fallback', () => {
    expect(initials('', 'ada_l')).toBe('A');
    expect(initials('   ', '_42ada')).toBe('4');
  });

  it('is empty when there is nothing to use', () => {
    expect(initials('', '')).toBe('');
    expect(initials('', '__')).toBe('');
  });
});
