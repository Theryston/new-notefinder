import { latestFromArchiveUrls } from './dump-urls.js';

const BASE = 'https://data.metabrainz.org/pub/musicbrainz/data';

describe('latestFromArchiveUrls', () => {
  it('reads the dump run from the sample archive URL', () => {
    expect(
      latestFromArchiveUrls([
        `${BASE}/sample/20260901-000002/mbdump-sample.tar.xz`,
      ]),
    ).toBe('20260901-000002');
  });

  it('reads the dump run from the first full archive URL', () => {
    expect(
      latestFromArchiveUrls([
        `${BASE}/fullexport/20260930-002222/mbdump.tar.bz2`,
        `${BASE}/fullexport/20260930-002222/mbdump-derived.tar.bz2`,
      ]),
    ).toBe('20260930-002222');
  });

  it('returns undefined for empty or malformed URLs', () => {
    expect(latestFromArchiveUrls([])).toBeUndefined();
    expect(latestFromArchiveUrls(['not-a-url'])).toBeUndefined();
    expect(latestFromArchiveUrls([''])).toBeUndefined();
  });
});
