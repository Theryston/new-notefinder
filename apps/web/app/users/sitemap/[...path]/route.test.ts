import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getUserSitemapFile } from '@/features/users/sitemap-queries';

import { GET } from './route';

vi.mock('@/features/users/sitemap-queries', () => ({
  getUserSitemapFile: vi.fn(),
}));
vi.mock('@/lib/sitemap/request-origin', () => ({
  requestSiteOrigin: () => 'https://notefinder.com.br',
}));

const mockFile = vi.mocked(getUserSitemapFile);

const get = (path: string[]) =>
  GET(new Request('https://internal/users/sitemap/0.xml'), {
    params: Promise.resolve({ path }),
  });

describe('GET /users/sitemap/[...path]', () => {
  beforeEach(() => {
    mockFile.mockReset();
  });

  it('serves the file as cacheable XML for the requested host', async () => {
    mockFile.mockResolvedValue([
      {
        id: 'user-1',
        username: 'grace',
        updatedAt: '2026-10-14T12:00:00.000Z',
      },
    ]);

    const response = await get(['2.xml']);

    expect(mockFile).toHaveBeenCalledWith(2);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(response.headers.get('vary')).toBe('X-Forwarded-Host, Host');
    expect(await response.text()).toContain(
      '<loc>https://notefinder.com.br/en/users/grace</loc>',
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
