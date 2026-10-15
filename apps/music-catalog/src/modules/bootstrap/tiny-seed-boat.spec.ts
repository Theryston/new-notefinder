import { tinySeed } from './tiny-seed.js';

describe('Boat in the tiny seed', () => {
  it('includes the official Ed Sheeran recording and its release references', () => {
    const artistMbid = 'b8a7c51f-362c-4dcb-a259-bc6e0095f0a6';
    const recordingMbid = 'f942f4fd-e5ad-43b3-ba4b-e6c0384222ba';
    const groupMbid = '4792e5c2-1051-4542-97ef-90e152a49902';
    const credit = [{ artist: artistMbid, name: 'Ed Sheeran', joinPhrase: '' }];

    expect(tinySeed.artists).toContainEqual(
      expect.objectContaining({ mbid: artistMbid, name: 'Ed Sheeran' }),
    );
    expect(tinySeed.recordings).toContainEqual({
      mbid: recordingMbid,
      title: 'Boat',
      lengthMs: 185666,
      disambiguation: '',
      video: false,
      artistCredit: credit,
      isrcs: ['GBAHS2201302'],
    });
    expect(tinySeed.releaseGroups).toContainEqual(
      expect.objectContaining({
        mbid: groupMbid,
        title: 'Boat',
        primaryType: 'Single',
        artistCredit: credit,
      }),
    );
    expect(tinySeed.releases).toContainEqual({
      mbid: '0f12e3ea-035d-4c6c-9f61-95a6dfba78f0',
      title: 'Boat',
      releaseGroup: groupMbid,
      status: 'Official',
      artistCredit: credit,
      events: [{ country: 'XW', year: 2023, month: 4, day: 21 }],
      media: [
        {
          mbid: '7232e32a-c0e0-3f7d-be9d-55ca5081a47d',
          position: 1,
          title: '',
          tracks: [
            {
              mbid: '34c62794-d7c4-471b-9b9c-c40806f50ede',
              position: 1,
              number: '1',
              title: 'Boat',
              lengthMs: 185000,
              recording: recordingMbid,
            },
          ],
        },
      ],
    });
  });
});
