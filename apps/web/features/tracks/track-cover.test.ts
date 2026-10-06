import { describe, expect, it } from 'vitest';

import { coverFallbackStyle } from './track-cover';

describe('coverFallbackStyle', () => {
  it('is deterministic for the same Recording', () => {
    expect(coverFallbackStyle('mbid-1')).toEqual(coverFallbackStyle('mbid-1'));
  });

  it('renders a diagonal gradient', () => {
    const { background } = coverFallbackStyle('mbid-1');
    expect(background).toMatch(
      /^linear-gradient\(135deg, hsl\(\d+, 65%, 55%\), hsl\(\d+, 65%, 42%\)\)$/,
    );
  });

  it('varies the hue by Recording', () => {
    expect(coverFallbackStyle('mbid-1')).not.toEqual(
      coverFallbackStyle('mbid-2'),
    );
  });
});
