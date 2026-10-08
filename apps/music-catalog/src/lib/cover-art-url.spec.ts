import { coverArtUrl, releaseGroupCoverArtUrl } from './cover-art-url.js';

describe('coverArtUrl', () => {
  it('points to the 500 px front cover of the release in the Cover Art Archive', () => {
    expect(coverArtUrl('76df3287-6cda-33eb-8e9a-044b5e15ffdd')).toBe(
      'https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15ffdd/front-500',
    );
  });
});

describe('releaseGroupCoverArtUrl', () => {
  it('points to the 500 px front cover of the release group in the Cover Art Archive', () => {
    expect(
      releaseGroupCoverArtUrl('76df3287-6cda-33eb-8e9a-044b5e15ffdd'),
    ).toBe(
      'https://coverartarchive.org/release-group/76df3287-6cda-33eb-8e9a-044b5e15ffdd/front-500',
    );
  });
});
