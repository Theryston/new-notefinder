import { describe, expect, it } from 'vitest';

import { robotsTxt } from './robots-txt';

const origin = 'https://notefinder.com.br';

describe('robotsTxt', () => {
  it('references the absolute index URL for the host', () => {
    expect(robotsTxt(origin)).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
    );
  });

  it('follows the requested host when a domain differs', () => {
    expect(robotsTxt('https://staging.example')).toContain(
      'Sitemap: https://staging.example/sitemap.xml',
    );
  });
});
