import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAlbumSitemapFile } from '@/features/albums/sitemap-queries';

import { GET } from './route';

vi.mock('@/features/albums/sitemap-queries', () => ({
  getAlbumSitemapFile: vi.fn(),
}));
vi.mock('@/lib/sitemap/request-origin', () => ({
  requestSiteOrigin: () => 'https://notefinder.com.br',
}));

const mockFile = vi.mocked(getAlbumSitemapFile);

const get = (path: string[]) =>
  GET(new Request('https://notefinder.com.br/albums/sitemap/0.xml'), {
    params: Promise.resolve({ path }),
  });

describe('GET /albums/sitemap/[...path]', () => {
  beforeEach(() => {
    mockFile.mockReset();
  });

  it('serves the file as XML for the requested host', async () => {
    mockFile.mockResolvedValue([
      { id: 'clx1', updatedAt: '2026-10-14T12:00:00.000Z' },
    ]);

    const response = await get(['2.xml']);

    expect(mockFile).toHaveBeenCalledWith(2);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(await response.text()).toContain(
      '<loc>https://notefinder.com.br/en/albums/clx1</loc>',
    );
  });

  it('answers 404 past the last file', async () => {
    mockFile.mockResolvedValue(undefined);

    expect((await get(['9.xml'])).status).toBe(404);
  });

  it('answers 404 for a path that is not a file, without reading anything', async () => {
    expect((await get(['nope.xml'])).status).toBe(404);
    expect(mockFile).not.toHaveBeenCalled();
  });
});
