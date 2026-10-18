import { describe, expect, it } from 'vitest';

import { sitemapShardIndex } from './sitemap-shard';

describe('sitemapShardIndex', () => {
  it('reads the number of a single numeric file', () => {
    expect(sitemapShardIndex(['0.xml'])).toBe(0);
    expect(sitemapShardIndex(['12.xml'])).toBe(12);
  });

  it('refuses anything that is not one numeric file', () => {
    expect(sitemapShardIndex([])).toBeUndefined();
    expect(sitemapShardIndex(['0.xml', 'extra'])).toBeUndefined();
    expect(sitemapShardIndex(['nope.xml'])).toBeUndefined();
    expect(sitemapShardIndex(['0.json'])).toBeUndefined();
  });
});
