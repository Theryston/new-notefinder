import { userTrackStateSchema } from '@notefinder/contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { trackFavorites } from '../src/database/schema/track-favorites.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createTrack,
  createTrackFavorite,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';
import { createLegacyTrackId } from './utils/track-processing-factories.js';

// PUT and DELETE /v1/me/favorites/:trackId and GET /v1/me/tracks/:trackId are
// private: they are the signed-in User's own state on a Track.
const ENDPOINTS = [
  { method: 'put', path: (id: string) => `/v1/me/favorites/${id}` },
  { method: 'delete', path: (id: string) => `/v1/me/favorites/${id}` },
  { method: 'get', path: (id: string) => `/v1/me/tracks/${id}` },
] as const;

describe('Favorites (e2e)', () => {
  const spec = useAuthSpec();
  let user: User;

  const favoritesOf = async (userId: string) =>
    spec.testApp.db
      .select({ trackId: trackFavorites.trackId })
      .from(trackFavorites)
      .where(eq(trackFavorites.userId, userId));

  const stateOf = async (trackId: string) => {
    const response = await spec.client
      .get(`/v1/me/tracks/${trackId}`)
      .expect(200);
    return userTrackStateSchema.parse(response.body);
  };

  beforeEach(async () => {
    user = await createUser(spec.testApp.db, { username: 'grace' });
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  });

  describe.each(ENDPOINTS)('$method $path', ({ method, path }) => {
    it('answers 401 without a session', async () => {
      const track = await createTrack(spec.testApp.db);

      const response = await request(spec.testApp.app.getHttpServer())
        [method](path(track.id))
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('answers 400 VALIDATION_FAILED for a Track ID that is too long', async () => {
      const response = await spec.client[method](path('x'.repeat(129))).expect(
        400,
      );

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'param' },
      });
    });

    it('answers 404 NOT_FOUND for an unknown Track', async () => {
      const response = await spec.client[method](path('nope')).expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('answers a legacy Track ID with 404 RESOURCE_MOVED and the new ID', async () => {
      const track = await createTrack(spec.testApp.db);
      await createLegacyTrackId(spec.testApp.db, track.id, 'clx123abc');

      const response = await spec.client[method](path('clx123abc')).expect(404);

      expect(response.body).toMatchObject({
        code: 'RESOURCE_MOVED',
        details: { id: track.id },
      });
      expect(await favoritesOf(user.id)).toEqual([]);
    });
  });

  describe('PUT /v1/me/favorites/:trackId', () => {
    it('adds the Track to the favorites', async () => {
      const track = await createTrack(spec.testApp.db);

      await spec.client.put(`/v1/me/favorites/${track.id}`).expect(204);

      expect(await favoritesOf(user.id)).toEqual([{ trackId: track.id }]);
      expect(await stateOf(track.id)).toEqual({ isFavorite: true });
    });

    it('is idempotent: favoriting a favorite keeps one row', async () => {
      const track = await createTrack(spec.testApp.db);

      await spec.client.put(`/v1/me/favorites/${track.id}`).expect(204);
      await spec.client.put(`/v1/me/favorites/${track.id}`).expect(204);

      expect(await favoritesOf(user.id)).toHaveLength(1);
    });

    it('keeps each User favorites apart', async () => {
      const track = await createTrack(spec.testApp.db);
      const other = await createUser(spec.testApp.db, { username: 'ada' });

      await spec.client.put(`/v1/me/favorites/${track.id}`).expect(204);

      expect(await favoritesOf(other.id)).toEqual([]);
    });
  });

  describe('DELETE /v1/me/favorites/:trackId', () => {
    it('removes the Track from the favorites, only for this User', async () => {
      const track = await createTrack(spec.testApp.db);
      const other = await createUser(spec.testApp.db, { username: 'ada' });
      await createTrackFavorite(spec.testApp.db, user.id, track.id);
      await createTrackFavorite(spec.testApp.db, other.id, track.id);

      await spec.client.delete(`/v1/me/favorites/${track.id}`).expect(204);

      expect(await favoritesOf(user.id)).toEqual([]);
      const kept = await spec.testApp.db
        .select()
        .from(trackFavorites)
        .where(
          and(
            eq(trackFavorites.userId, other.id),
            eq(trackFavorites.trackId, track.id),
          ),
        );
      expect(kept).toHaveLength(1);
      expect(await stateOf(track.id)).toEqual({ isFavorite: false });
    });

    it('is idempotent: unfavoriting a Track that is not one still succeeds', async () => {
      const track = await createTrack(spec.testApp.db);

      await spec.client.delete(`/v1/me/favorites/${track.id}`).expect(204);
      await spec.client.delete(`/v1/me/favorites/${track.id}`).expect(204);

      expect(await favoritesOf(user.id)).toEqual([]);
    });
  });

  describe('GET /v1/me/tracks/:trackId', () => {
    it('says a Track the User never favorited is not a favorite', async () => {
      const track = await createTrack(spec.testApp.db);

      expect(await stateOf(track.id)).toEqual({ isFavorite: false });
    });
  });
});
