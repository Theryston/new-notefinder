import {
  latestUrl,
  resolveDumpUrls,
  resolveLatestDumpUrls,
} from './dump-urls.js';

const BASE = 'https://data.metabrainz.org/pub/musicbrainz/data';

describe('dump urls', () => {
  it('points the sample at its single tar.xz next to the full export', () => {
    expect(resolveDumpUrls(BASE, 'sample', '20260901-000002')).toEqual([
      `${BASE}/sample/20260901-000002/mbdump-sample.tar.xz`,
    ]);
  });

  it('points the full dataset at the core and derived archives, without edit history', () => {
    expect(resolveDumpUrls(BASE, 'full', '20260930-002222')).toEqual([
      `${BASE}/fullexport/20260930-002222/mbdump.tar.bz2`,
      `${BASE}/fullexport/20260930-002222/mbdump-derived.tar.bz2`,
    ]);
  });

  it('tolerates a trailing slash on the base URL and a newline in LATEST', () => {
    expect(resolveDumpUrls(`${BASE}/`, 'sample', '20260901-000002\n')).toEqual([
      `${BASE}/sample/20260901-000002/mbdump-sample.tar.xz`,
    ]);
  });

  it('reads the dump run from the LATEST file', async () => {
    const fetchImpl = (async (url: URL | string) => {
      expect(String(url)).toBe(`${BASE}/fullexport/LATEST`);
      return new Response('20260930-002222\n');
    }) as typeof fetch;

    await expect(
      resolveLatestDumpUrls(BASE, 'full', fetchImpl),
    ).resolves.toEqual([
      `${BASE}/fullexport/20260930-002222/mbdump.tar.bz2`,
      `${BASE}/fullexport/20260930-002222/mbdump-derived.tar.bz2`,
    ]);
  });

  it('names the base URL when LATEST answers with an error', async () => {
    const fetchImpl = (async () =>
      new Response('Not Found', { status: 404 })) as typeof fetch;

    await expect(
      resolveLatestDumpUrls(BASE, 'sample', fetchImpl),
    ).rejects.toThrow(/MUSICBRAINZ_DUMP_BASE_URL/);
  });

  it('refuses an empty LATEST file', async () => {
    const fetchImpl = (async () => new Response('  \n')) as typeof fetch;

    await expect(
      resolveLatestDumpUrls(BASE, 'sample', fetchImpl),
    ).rejects.toThrow(/empty/);
  });

  it('derives the LATEST url from the dataset directory', () => {
    expect(latestUrl(BASE, 'sample')).toBe(`${BASE}/sample/LATEST`);
    expect(latestUrl(BASE, 'full')).toBe(`${BASE}/fullexport/LATEST`);
  });
});
