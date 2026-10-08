import { describe, expect, it } from 'vitest';

import { creditText } from './track-credit';

describe('creditText', () => {
  it('reads a single artist as its name', () => {
    expect(creditText([{ name: 'Queen', joinPhrase: '' }])).toBe('Queen');
  });

  it('keeps the join phrases between the artists, in credit order', () => {
    expect(
      creditText([
        { name: 'Queen', joinPhrase: ' feat. ' },
        { name: 'David Bowie', joinPhrase: ' & ' },
        { name: 'Freddie', joinPhrase: '' },
      ]),
    ).toBe('Queen feat. David Bowie & Freddie');
  });

  it('is empty for a Track whose credit is not known yet', () => {
    expect(creditText([])).toBe('');
  });
});
