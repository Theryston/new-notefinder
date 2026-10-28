import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sitemap/request-origin', () => ({
  requestSiteOrigin: () => 'https://vozzify.com',
}));

const { GET } = await import('./route');

const request = new Request('https://vozzify.com/pages/sitemap/0.xml');

const get = (path: string[]) =>
  GET(request, { params: Promise.resolve({ path }) });

describe('GET /pages/sitemap/[...path]', () => {
  it('serves the general pages as XML for the requested host', async () => {
    const response = await get(['0.xml']);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('vary')).toBe('X-Forwarded-Host, Host');
    const xml = await response.text();
    expect(xml).toContain('<loc>https://vozzify.com/en/terms</loc>');
    expect(xml).toContain('<loc>https://vozzify.com/pt-BR/sign-in</loc>');
  });

  it('answers 404 past the only file and for anything that is not a shard', async () => {
    expect((await get(['1.xml'])).status).toBe(404);
    expect((await get(['nope.xml'])).status).toBe(404);
    expect((await get(['0.xml', 'extra'])).status).toBe(404);
  });
});
