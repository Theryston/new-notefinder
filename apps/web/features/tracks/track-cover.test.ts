import { describe, expect, it } from 'vitest';

import { coverFallbackStyle, coverPlaceholder } from './track-cover';

describe('coverPlaceholder', () => {
  it('is deterministic for the same Recording', () => {
    expect(coverPlaceholder('mbid-1')).toEqual(coverPlaceholder('mbid-1'));
  });

  it('returns a curated palette with a variant from 0 to 5', () => {
    const placeholder = coverPlaceholder('mbid-1');
    expect(placeholder.variant).toBeGreaterThanOrEqual(0);
    expect(placeholder.variant).toBeLessThan(6);
    expect(placeholder.c1).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(placeholder.c2).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(placeholder.c3).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('varies the placeholder by Recording', () => {
    const placeholders = new Set(
      [
        'mbid-1',
        'mbid-2',
        'mbid-3',
        'mbid-4',
        'mbid-5',
        'mbid-6',
        'mbid-7',
      ].map((seed) => JSON.stringify(coverPlaceholder(seed))),
    );
    expect(placeholders.size).toBeGreaterThan(1);
  });
});

describe('coverFallbackStyle', () => {
  it('is deterministic for the same Recording', () => {
    expect(coverFallbackStyle('mbid-1')).toEqual(coverFallbackStyle('mbid-1'));
  });

  it('renders a diagonal gradient from the curated palette', () => {
    const { background } = coverFallbackStyle('mbid-1');
    expect(background).toMatch(
      /^linear-gradient\(135deg, #[0-9A-Fa-f]{6}, #[0-9A-Fa-f]{6}\)$/,
    );
  });

  it('varies the gradient by Recording', () => {
    expect(coverFallbackStyle('mbid-1')).not.toEqual(
      coverFallbackStyle('mbid-4'),
    );
  });
});
