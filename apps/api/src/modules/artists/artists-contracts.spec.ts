import {
  artistSchema,
  resourceMovedDetailsSchema,
} from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';

// Locks the artist header contract: what the detail endpoint answers, and
// the `RESOURCE_MOVED` details the web redirects with.
describe('artist contracts', () => {
  it('parses the artist header detail', () => {
    const artist = {
      id: 'artist-1',
      mbid: testMbid(1001),
      name: 'Queen',
      genres: ['rock', 'pop'],
      trackCount: 2,
    };

    expect(artistSchema.parse(artist)).toEqual(artist);
  });

  it('accepts an artist with no genres or tracks yet', () => {
    const artist = {
      id: 'artist-1',
      mbid: testMbid(1001),
      name: 'Queen',
      genres: [],
      trackCount: 0,
    };

    expect(artistSchema.parse(artist)).toEqual(artist);
  });

  it.each([
    { name: '', trackCount: 0 },
    { name: 'Queen', trackCount: -1 },
    { name: 'Queen', genres: [''] },
  ])('rejects the invalid artist %j', (overrides) => {
    expect(() =>
      artistSchema.parse({
        id: 'artist-1',
        mbid: testMbid(1001),
        genres: [],
        ...overrides,
      }),
    ).toThrow();
  });

  it('carries the new ID in RESOURCE_MOVED details', () => {
    expect(resourceMovedDetailsSchema.parse({ id: 'artist-1' })).toEqual({
      id: 'artist-1',
    });
  });
});
