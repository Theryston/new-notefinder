import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTrackSitemapFile } from '@/features/tracks/sitemap-queries';

import { GET } from './route';

vi.mock('@/features/tracks/sitemap-queries', () => ({
  getTrackSitemapFile: vi.fn(),
}));
vi.mock('@/lib/sitemap/request-origin', () => ({
  requestSiteOrigin: () => 'https://vozzify.com',
}));

const mockFile = vi.mocked(getTrackSitemapFile);

const get = (path: string[]) =>
  GET(new Request('http://localhost/tracks/sitemap/0.xml'), {
    params: Promise.resolve({ path }),
  });

describe('GET /tracks/sitemap/[...path]', () => {
  beforeEach(() => {
    mockFile.mockReset();
  });

  it('serves the file as XML', async () => {
    mockFile.mockResolvedValue([
      { id: 'clx1', updatedAt: '2026-10-14T12:00:00.000Z' },
    ]);

    const response = await get(['2.xml']);

    expect(mockFile).toHaveBeenCalledWith(2);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(await response.text()).toContain('/en/tracks/clx1');
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
