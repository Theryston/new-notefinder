import { describe, expect, it } from 'vitest';

import { transposedKeyName } from './key-name';

describe('transposedKeyName', () => {
  it('names the key as it is when nothing moves', () => {
    expect(transposedKeyName({ tonic: 7, mode: 'MAJOR' }, 0)).toEqual({
      tonic: 'G',
      mode: 'MAJOR',
    });
  });

  it('names the key after a transposition, sharps as #', () => {
    expect(transposedKeyName({ tonic: 7, mode: 'MINOR' }, 1)).toEqual({
      tonic: 'G#',
      mode: 'MINOR',
    });
    expect(transposedKeyName({ tonic: 0, mode: 'MAJOR' }, -1).tonic).toBe('B');
  });
});
