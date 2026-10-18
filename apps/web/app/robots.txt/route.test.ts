import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sitemap/request-origin', () => ({
  requestSiteOrigin: () => 'http://localhost:3000',
}));

const { GET } = await import('./route');

describe('GET /robots.txt', () => {
  it('references the index of the requested host as plain text', async () => {
    const response = await GET(new Request('http://localhost:3000/robots.txt'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toContain(
      'Sitemap: http://localhost:3000/sitemap.xml',
    );
  });

  it('caches per host for the shared crawler lifetime and varies on the host', async () => {
    const response = await GET(new Request('http://localhost:3000/robots.txt'));

    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
    expect(response.headers.get('vary')).toBe('X-Forwarded-Host, Host');
  });
});
