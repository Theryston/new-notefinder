import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getArtistSitemapFile } from '@/features/artists/sitemap-queries';

import { GET } from './route';

vi.mock('@/features/artists/sitemap-queries', () => ({
  getArtistSitemapFile: vi.fn(),
}));
vi.mock('@/lib/sitemap/request-origin', () => ({
  requestSiteOrigin: () => 'https://notefinder.com.br',
}));

const mockFile = vi.mocked(getArtistSitemapFile);

const get = (path: string[]) =>
  GET(new Request('https://notefinder.com.br/artists/sitemap/0.xml'), {
    params: Promise.resolve({ path }),
  });

describe('GET /artists/sitemap/[...path]', () => {
  beforeEach(() => {
    mockFile.mockReset();
  });

  it('serves the file as XML for the requested host', async () => {
    mockFile.mockResolvedValue([
      { id: 'clx1', updatedAt: '2026-10-14T12:00:00.000Z' },
    ]);

    const response = await get(['0.xml']);

    expect(mockFile).toHaveBeenCalledWith(0);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(await response.text()).toContain(
      '<loc>https://notefinder.com.br/pt-BR/artists/clx1</loc>',
    );
  });

  it('answers 404 past the last file and for a path that is not a file', async () => {
    mockFile.mockResolvedValue(undefined);

    expect((await get(['3.xml'])).status).toBe(404);
    expect((await get(['nope.xml'])).status).toBe(404);
  });
});
