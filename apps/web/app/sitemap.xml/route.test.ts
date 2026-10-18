import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sitemap/request-origin', () => ({
  requestSiteOrigin: () => 'https://notefinder.com.br',
}));

const { GET } = await import('./route');

describe('GET /sitemap.xml', () => {
  it('serves the index as cacheable XML, listing the requested host', async () => {
    const response = await GET(new Request('https://internal/sitemap.xml'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(response.headers.get('vary')).toBe('X-Forwarded-Host, Host');
    const xml = await response.text();
    expect(xml).toContain(
      '<loc>https://notefinder.com.br/pages/sitemap/0.xml</loc>',
    );
    expect(xml).toContain(
      '<loc>https://notefinder.com.br/users/sitemap/0.xml</loc>',
    );
  });
});
