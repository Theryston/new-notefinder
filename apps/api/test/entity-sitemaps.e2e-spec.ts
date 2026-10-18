import {
  albumSitemapPageSchema,
  artistSitemapPageSchema,
  userSitemapPageSchema,
} from '@notefinder/contracts';
import request from 'supertest';
import {
  createAlbumDisc,
  placeAlbumTrack,
} from './utils/album-track-factories.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createAlbum,
  createArtist,
  createTrack,
  createUser,
  linkTrackArtist,
} from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

// The Albums, Artists and Users sitemaps: public, cursor-paged listings in ID
// order. Each lists only what has a public page: an Album or Artist with a
// completed Track, a User with a Username.
type Listing = {
  path: string;
  pageSchema: typeof albumSitemapPageSchema;
  /** Creates entities that must be listed, and returns their IDs. */
  listed: () => Promise<string[]>;
  /** Creates entities that must not be listed, and returns their IDs. */
  unlisted: () => Promise<string[]>;
};

describe('Entity sitemaps (e2e)', () => {
  const spec = useAuthSpec();

  const anonymous = () => request(spec.testApp.app.getHttpServer());

  const listings: Listing[] = [
    {
      path: 'albums',
      pageSchema: albumSitemapPageSchema,
      listed: async () => {
        const db = spec.testApp.db;
        const album = await createAlbum(db);
        const track = await createCompletedTrack(db);
        await createAlbumDisc(db, album.id, 1);
        await placeAlbumTrack(db, {
          albumId: album.id,
          trackId: track.id,
          discPosition: 1,
          trackPosition: 1,
        });
        const second = await createAlbum(db);
        await createAlbumDisc(db, second.id, 1);
        await placeAlbumTrack(db, {
          albumId: second.id,
          trackId: (await createCompletedTrack(db)).id,
          discPosition: 1,
          trackPosition: 1,
        });
        return [album.id, second.id];
      },
      unlisted: async () => {
        const db = spec.testApp.db;
        const empty = await createAlbum(db);
        const pending = await createAlbum(db);
        const track = await createTrack(db);
        await createAlbumDisc(db, pending.id, 1);
        await placeAlbumTrack(db, {
          albumId: pending.id,
          trackId: track.id,
          discPosition: 1,
          trackPosition: 1,
        });
        return [empty.id, pending.id];
      },
    },
    {
      path: 'artists',
      pageSchema: artistSitemapPageSchema,
      listed: async () => {
        const db = spec.testApp.db;
        const artist = await createArtist(db);
        await linkTrackArtist(
          db,
          (await createCompletedTrack(db)).id,
          artist.id,
        );
        const second = await createArtist(db);
        await linkTrackArtist(
          db,
          (await createCompletedTrack(db)).id,
          second.id,
        );
        return [artist.id, second.id];
      },
      unlisted: async () => {
        const db = spec.testApp.db;
        const empty = await createArtist(db);
        const pending = await createArtist(db);
        await linkTrackArtist(db, (await createTrack(db)).id, pending.id);
        return [empty.id, pending.id];
      },
    },
    {
      path: 'users',
      pageSchema: userSitemapPageSchema,
      listed: async () => {
        const db = spec.testApp.db;
        const user = await createUser(db, { username: 'grace' });
        const second = await createUser(db, { username: 'ada' });
        return [user.id, second.id];
      },
      unlisted: async () => {
        const db = spec.testApp.db;
        const first = await createUser(db, { username: null });
        const second = await createUser(db, { username: null });
        return [first.id, second.id];
      },
    },
  ];

  describe.each(listings)('GET /v1/sitemaps/$path', (listing) => {
    const url = `/v1/sitemaps/${listing.path}`;

    it('lists the public entities in ID order and no others', async () => {
      const listed = await listing.listed();
      await listing.unlisted();

      const response = await anonymous().get(url).expect(200);

      const page = listing.pageSchema.parse(response.body);
      expect(page.items.map((item) => item.id)).toEqual([...listed].sort());
      expect(page.nextCursor).toBeNull();
    });

    it('walks the pages with cursors, one entity at a time', async () => {
      const listed = await listing.listed();
      await listing.unlisted();
      const seen: string[] = [];
      let cursor: string | null = null;

      do {
        const query = cursor ? `?limit=1&cursor=${cursor}` : '?limit=1';
        const response = await anonymous().get(`${url}${query}`).expect(200);
        const page = listing.pageSchema.parse(response.body);
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
      } while (cursor !== null);

      expect(seen).toEqual([...listed].sort());
    });

    it('answers 400 VALIDATION_FAILED for a cursor it did not issue', async () => {
      const response = await anonymous().get(`${url}?cursor=nope`).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  // A Profile URL is built from the Username, so each Users entry carries it.
  it('GET /v1/sitemaps/users: each listed User carries its Username', async () => {
    const grace = await createUser(spec.testApp.db, { username: 'grace' });
    await createUser(spec.testApp.db, { username: null });

    const response = await anonymous().get('/v1/sitemaps/users').expect(200);

    const page = userSitemapPageSchema.parse(response.body);
    expect(page.items).toEqual([
      { id: grace.id, username: 'grace', updatedAt: expect.any(String) },
    ]);
  });
});
