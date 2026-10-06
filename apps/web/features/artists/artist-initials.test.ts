import { describe, expect, it } from 'vitest';

import { artistInitials } from './artist-initials';

describe('artistInitials', () => {
  it('takes the first letter of the first and last names', () => {
    expect(artistInitials('Billie Eilish')).toBe('BE');
    expect(artistInitials('billie eilish pirate')).toBe('BP');
  });

  it('uses one letter for a single name', () => {
    expect(artistInitials('Queen')).toBe('Q');
  });

  it('ignores extra whitespace', () => {
    expect(artistInitials('  Billie   Eilish  ')).toBe('BE');
  });

  it('keeps accented and non-Latin letters whole', () => {
    expect(artistInitials('Ícaro Ñúñez')).toBe('ÍÑ');
  });

  it('is empty when there is no name', () => {
    expect(artistInitials('')).toBe('');
    expect(artistInitials('   ')).toBe('');
  });
});
