import { catalogPageTags } from './catalog-page-tags.js';

describe('catalogPageTags', () => {
  it('lists the header and the track list of every Artist and Album, Artists first', () => {
    expect(
      catalogPageTags({ artistIds: ['artist-1'], albumIds: ['album-1'] }),
    ).toEqual([
      'artist:artist-1',
      'artist:artist-1:tracks',
      'album:album-1',
      'album:album-1:tracks',
    ]);
  });

  it('answers no tags for a Track with no Artists or Albums', () => {
    expect(catalogPageTags({ artistIds: [], albumIds: [] })).toEqual([]);
  });
});
