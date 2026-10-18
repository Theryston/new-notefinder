import { describe, expect, it } from 'vitest';

import { GET } from './route';

const request = new Request('https://notefinder.com.br/pages/sitemap/0.xml', {
  headers: { 'x-forwarded-host': 'notefinder.com.br' },
});

const get = (path: string[]) =>
  GET(request, { params: Promise.resolve({ path }) });

describe('GET /pages/sitemap/[...path]', () => {
  it('serves the general pages as XML for the requested host', async () => {
    const response = await get(['0.xml']);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    const xml = await response.text();
    expect(xml).toContain('<loc>https://notefinder.com.br/en/terms</loc>');
    expect(xml).toContain('<loc>https://notefinder.com.br/pt-BR/sign-in</loc>');
  });

  it('answers 404 past the only file and for anything that is not a shard', async () => {
    expect((await get(['1.xml'])).status).toBe(404);
    expect((await get(['nope.xml'])).status).toBe(404);
    expect((await get(['0.xml', 'extra'])).status).toBe(404);
  });
});
