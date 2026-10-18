import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /sitemap.xml', () => {
  it('serves the index as cacheable XML, listing the requested host', async () => {
    const response = await GET(
      new Request('http://internal/sitemap.xml', {
        headers: {
          'x-forwarded-host': 'notefinder.com.br',
          'x-forwarded-proto': 'https',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    const xml = await response.text();
    expect(xml).toContain(
      '<loc>https://notefinder.com.br/pages/sitemap/0.xml</loc>',
    );
    expect(xml).toContain(
      '<loc>https://notefinder.com.br/users/sitemap/0.xml</loc>',
    );
  });
});
