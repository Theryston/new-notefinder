import { describe, expect, it } from 'vitest';

import { formatVocalRange } from './format-vocal-range';

describe('formatVocalRange', () => {
  it('writes both ends in scientific pitch notation with an en dash', () => {
    expect(
      formatVocalRange({
        lowest: { note: 'E', octave: 2 },
        highest: { note: 'A#', octave: 4 },
      }),
    ).toBe('E2–A#4');
  });

  it('keeps negative octaves', () => {
    expect(
      formatVocalRange({
        lowest: { note: 'B', octave: -1 },
        highest: { note: 'C', octave: 0 },
      }),
    ).toBe('B-1–C0');
  });
});
