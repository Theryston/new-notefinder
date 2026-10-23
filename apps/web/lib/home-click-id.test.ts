import { describe, expect, it } from 'vitest';
import { consumeClickId, withClickId } from './home-click-id';

describe('home click id links', () => {
  it('adds a click id while preserving other query parameters and fragments', () => {
    expect(withClickId('/en/tracks/song?from=home#verse-2', 'click-1')).toBe(
      '/en/tracks/song?from=home&clickId=click-1#verse-2',
    );
  });

  it('removes the click id before the Track URL is shared', () => {
    expect(
      consumeClickId('/en/tracks/song?from=home&clickId=click-1#verse-2'),
    ).toEqual({
      clickId: 'click-1',
      cleanHref: '/en/tracks/song?from=home#verse-2',
    });
  });

  it('leaves a shared link without a click id unchanged', () => {
    expect(consumeClickId('/en/tracks/song?from=search')).toEqual({
      clickId: undefined,
      cleanHref: '/en/tracks/song?from=search',
    });
  });
});
