import {
  albumSchema,
  albumTracksPageSchema,
  artistSchema,
  catalogTracksPageSchema,
} from '@notefinder/contracts';
import {
  createAlbumDisc,
  placeAlbumTrack,
} from './utils/album-track-factories.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createAlbum,
  createArtist,
  createTrack,
  linkTrackArtist,
} from './utils/factories.js';
import { createTrackProcessing } from './utils/track-processing-factories.js';

// Artist and Album reads show only Tracks with a completed Processing (ADR 0005):
// headers, track lists and counts. An Artist or Album with none is not found.
describe('Artist and Album reads list only completed Tracks (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  /** A Track of the Artist, whose Processing is in the given status. */
  const artistTrack = async (
    artistId: string,
    status: 'QUEUED' | 'COMPLETED' | 'FAILED',
    title: string,
  ) => {
    const track = await createTrack(testApp.db, { title });
    await linkTrackArtist(testApp.db, track.id, artistId);
    await createTrackProcessing(testApp.db, track.id, { status });
    return track;
  };

  describe('Artist', () => {
    it('counts and lists only the Tracks whose Processing is completed', async () => {
      const artist = await createArtist(testApp.db, { name: 'Queen' });
      const done = await artistTrack(artist.id, 'COMPLETED', 'Done');
      await artistTrack(artist.id, 'QUEUED', 'Queued');
      await artistTrack(artist.id, 'FAILED', 'Failed');

      const header = await testApp.http
        .get(`/v1/artists/${artist.id}`)
        .expect(200);
      expect(artistSchema.parse(header.body)).toEqual(header.body);
      expect(header.body).toMatchObject({ trackCount: 1 });

      const list = await testApp.http
        .get(`/v1/artists/${artist.id}/tracks`)
        .expect(200);
      const page = catalogTracksPageSchema.parse(list.body);
      expect(page.items.map((item) => item.id)).toEqual([done.id]);
    });

    it('answers NOT_FOUND for an Artist with no completed Track yet', async () => {
      const artist = await createArtist(testApp.db);
      await artistTrack(artist.id, 'QUEUED', 'Still processing');

      const header = await testApp.http
        .get(`/v1/artists/${artist.id}`)
        .expect(404);
      expect(header.body).toMatchObject({ code: 'NOT_FOUND' });

      const list = await testApp.http
        .get(`/v1/artists/${artist.id}/tracks`)
        .expect(404);
      expect(list.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('answers NOT_FOUND for an Artist with no Track at all', async () => {
      const artist = await createArtist(testApp.db);

      await testApp.http.get(`/v1/artists/${artist.id}`).expect(404);
    });

    it('shows a Track of the Artist once a retry of its Processing completes', async () => {
      const artist = await createArtist(testApp.db);
      const track = await createTrack(testApp.db);
      await linkTrackArtist(testApp.db, track.id, artist.id);
      await createTrackProcessing(testApp.db, track.id, { status: 'FAILED' });
      await testApp.http.get(`/v1/artists/${artist.id}`).expect(404);

      await createTrackProcessing(testApp.db, track.id, {
        status: 'COMPLETED',
      });

      const header = await testApp.http
        .get(`/v1/artists/${artist.id}`)
        .expect(200);
      expect(header.body).toMatchObject({ trackCount: 1 });
    });
  });

  describe('Album', () => {
    /**
     * A Track placed on the Album, whose Processing is in the given status. It
     * has an Artist, as every catalog Track does.
     */
    const albumTrack = async (
      albumId: string,
      status: 'QUEUED' | 'COMPLETED' | 'FAILED',
      trackPosition: number,
    ) => {
      const track = await createTrack(testApp.db, {
        title: `Track ${trackPosition}`,
      });
      const artist = await createArtist(testApp.db);
      await linkTrackArtist(testApp.db, track.id, artist.id);
      await placeAlbumTrack(testApp.db, {
        albumId,
        trackId: track.id,
        discPosition: 1,
        trackPosition,
      });
      await createTrackProcessing(testApp.db, track.id, { status });
      return track;
    };

    it('counts and lists only the Tracks whose Processing is completed, in album order', async () => {
      const album = await createAlbum(testApp.db);
      await createAlbumDisc(testApp.db, album.id, 1, null);
      const second = await albumTrack(album.id, 'COMPLETED', 2);
      const first = await albumTrack(album.id, 'COMPLETED', 1);
      await albumTrack(album.id, 'FAILED', 3);

      const header = await testApp.http
        .get(`/v1/albums/${album.id}`)
        .expect(200);
      expect(albumSchema.parse(header.body)).toEqual(header.body);
      expect(header.body).toMatchObject({ trackCount: 2 });

      const list = await testApp.http
        .get(`/v1/albums/${album.id}/tracks`)
        .expect(200);
      const page = albumTracksPageSchema.parse(list.body);
      expect(page.items.map((item) => item.id)).toEqual([first.id, second.id]);
    });

    it('answers NOT_FOUND for an Album with no completed Track yet', async () => {
      const album = await createAlbum(testApp.db);
      await createAlbumDisc(testApp.db, album.id, 1, null);
      await albumTrack(album.id, 'QUEUED', 1);

      await testApp.http.get(`/v1/albums/${album.id}`).expect(404);
      const list = await testApp.http
        .get(`/v1/albums/${album.id}/tracks`)
        .expect(404);
      expect(list.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('answers NOT_FOUND for an Album with no Track at all', async () => {
      const album = await createAlbum(testApp.db);

      await testApp.http.get(`/v1/albums/${album.id}`).expect(404);
    });
  });
});
