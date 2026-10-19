import { profileFollowSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { userFollows } from '../src/database/schema/user-follows.js';
import { users } from '../src/database/schema/users.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  createUserFollow,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

// PUT and DELETE /v1/me/following/:userId are the signed-in User's own follows.
const ENDPOINTS = [
  { method: 'put', path: (id: string) => `/v1/me/following/${id}` },
  { method: 'delete', path: (id: string) => `/v1/me/following/${id}` },
] as const;

describe('Follows (e2e)', () => {
  const spec = useAuthSpec();
  let viewer: User;
  let grace: User;

  const followsOf = (followerId: string) =>
    spec.testApp.db
      .select({ followingId: userFollows.followingId })
      .from(userFollows)
      .where(eq(userFollows.followerId, followerId));

  const signInAs = async (user: User) => {
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  beforeEach(async () => {
    viewer = await createUser(spec.testApp.db, { username: 'ada' });
    grace = await createUser(spec.testApp.db, { username: 'grace' });
    await signInAs(viewer);
  });

  describe.each(ENDPOINTS)('$method $path', ({ method, path }) => {
    it('answers 401 without a session', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        [method](path(grace.id))
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('answers 403 USERNAME_REQUIRED for a signed-in User without a username', async () => {
      const noUsername = await createUser(spec.testApp.db, { username: null });
      await signInAs(noUsername);

      const response = await spec.client[method](path(grace.id)).expect(403);

      expect(response.body).toMatchObject({ code: 'USERNAME_REQUIRED' });
      expect(await followsOf(noUsername.id)).toEqual([]);
    });

    it('answers 400 VALIDATION_FAILED for a User ID that is too long', async () => {
      const response = await spec.client[method](path('x'.repeat(129))).expect(
        400,
      );

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'param' },
      });
    });

    it('answers 404 NOT_FOUND for an unknown User', async () => {
      const response = await spec.client[method](path('nobody')).expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('PUT /v1/me/following/:userId', () => {
    it('follows the User and answers 204 with no body', async () => {
      const response = await spec.client
        .put(`/v1/me/following/${grace.id}`)
        .expect(204);

      expect(response.body).toEqual({});
      expect(await followsOf(viewer.id)).toEqual([{ followingId: grace.id }]);
    });

    it('follows a User once: following them again changes nothing', async () => {
      await spec.client.put(`/v1/me/following/${grace.id}`).expect(204);
      await spec.client.put(`/v1/me/following/${grace.id}`).expect(204);

      expect(await followsOf(viewer.id)).toHaveLength(1);
    });

    it('answers 400 BAD_REQUEST when the User follows themselves', async () => {
      const response = await spec.client
        .put(`/v1/me/following/${viewer.id}`)
        .expect(400);

      expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
      expect(await followsOf(viewer.id)).toEqual([]);
    });
  });

  describe('DELETE /v1/me/following/:userId', () => {
    it('stops following the User and answers 204', async () => {
      await createUserFollow(spec.testApp.db, viewer.id, grace.id);

      await spec.client.delete(`/v1/me/following/${grace.id}`).expect(204);

      expect(await followsOf(viewer.id)).toEqual([]);
    });

    it('answers 204 for a User not followed, and changes nothing', async () => {
      await spec.client.delete(`/v1/me/following/${grace.id}`).expect(204);

      expect(await followsOf(viewer.id)).toEqual([]);
    });

    it('leaves the follows the other way round alone', async () => {
      await createUserFollow(spec.testApp.db, grace.id, viewer.id);

      await spec.client.delete(`/v1/me/following/${grace.id}`).expect(204);

      expect(await followsOf(grace.id)).toEqual([{ followingId: viewer.id }]);
    });
  });

  describe('GET /v1/users/:username/follow', () => {
    it('answers the ID of the Profile User and that the viewer follows it', async () => {
      await createUserFollow(spec.testApp.db, viewer.id, grace.id);

      const response = await spec.client
        .get('/v1/users/GRACE/follow')
        .expect(200);

      expect(profileFollowSchema.parse(response.body)).toEqual({
        userId: grace.id,
        isFollowing: true,
      });
    });

    it('answers isFollowing false when the viewer does not follow the User', async () => {
      const response = await spec.client
        .get('/v1/users/grace/follow')
        .expect(200);

      expect(response.body).toEqual({ userId: grace.id, isFollowing: false });
    });

    it('answers 401 without a session, since visitors have no follow state', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        .get('/v1/users/grace/follow')
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('answers 404 NOT_FOUND for an unknown username', async () => {
      const response = await spec.client
        .get('/v1/users/nobody/follow')
        .expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('the follows table', () => {
    it('refuses a User following themselves, whatever writes the row', async () => {
      await expect(
        spec.testApp.db
          .insert(userFollows)
          .values({ followerId: viewer.id, followingId: viewer.id }),
      ).rejects.toThrow();
    });

    it('removes the follows in both directions when a User is deleted', async () => {
      await createUserFollow(spec.testApp.db, viewer.id, grace.id);
      await createUserFollow(spec.testApp.db, grace.id, viewer.id);

      await spec.testApp.db.delete(users).where(eq(users.id, grace.id));

      expect(await followsOf(viewer.id)).toEqual([]);
      expect(await spec.testApp.db.select().from(userFollows)).toEqual([]);
    });
  });
});
