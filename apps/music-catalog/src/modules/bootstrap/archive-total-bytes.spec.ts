import { fetchArchiveTotalBytes } from './dump-urls.js';

const headResponse = (contentLength: string | null, ok = true): Response =>
  ({
    ok,
    status: ok ? 200 : 404,
    headers: {
      get: (name: string) => (name === 'content-length' ? contentLength : null),
    },
  }) as unknown as Response;

const fetchOf = (lengths: readonly (string | null)[]): typeof fetch => {
  const calls: string[] = [];
  const fetchImpl = (async (url: unknown) => {
    calls.push(String(url));
    const length = lengths[calls.length - 1] ?? null;
    return headResponse(length);
  }) as unknown as typeof fetch;
  return fetchImpl;
};

describe('fetchArchiveTotalBytes', () => {
  it('sums the Content-Length of every archive', async () => {
    const urls = ['https://a/mbdump.tar.bz2', 'https://a/derived.tar.bz2'];

    await expect(
      fetchArchiveTotalBytes(urls, fetchOf(['100', '50'])),
    ).resolves.toBe(150);
  });

  it('omits the total when an archive has no usable size', async () => {
    const urls = ['https://a/mbdump.tar.bz2', 'https://a/derived.tar.bz2'];

    await expect(
      fetchArchiveTotalBytes(urls, fetchOf(['100', null])),
    ).resolves.toBeUndefined();
  });

  it('omits the total when a HEAD request fails, without throwing', async () => {
    const failing = (async () => {
      throw new Error('network is down');
    }) as unknown as typeof fetch;

    await expect(
      fetchArchiveTotalBytes(['https://a/x'], failing),
    ).resolves.toBeUndefined();
  });

  it('omits the total for an empty archive list', async () => {
    await expect(
      fetchArchiveTotalBytes([], fetchOf([])),
    ).resolves.toBeUndefined();
  });
});
