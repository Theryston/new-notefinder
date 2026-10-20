import { publicProfileSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { userFollows } from '../src/database/schema/user-follows.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  createUserFollow,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

// DELETE /v1/me/followers/:userId: the signed-in User removes one of their
// own followers.
describe('Me followers (e2e)', () => {
  const spec = useAuthSpec();
  let owner: User;
  let fan: User;
  let other: User;

  const followersOf = (followingId: string) =>
    spec.testApp.db
      .select({ followerId: userFollows.followerId })
      .from(userFollows)
      .where(eq(userFollows.followingId, followingId));

  const signInAs = async (user: User) => {
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  beforeEach(async () => {
    owner = await createUser(spec.testApp.db, { username: 'ada' });
    fan = await createUser(spec.testApp.db, { username: 'grace' });
    other = await createUser(spec.testApp.db, { username: 'linus' });
    await createUserFollow(spec.testApp.db, fan.id, owner.id);
    await createUserFollow(spec.testApp.db, other.id, owner.id);
    await signInAs(owner);
  });

  it('answers 401 UNAUTHORIZED without a session', async () => {
    const response = await request(spec.testApp.app.getHttpServer())
      .delete(`/v1/me/followers/${fan.id}`)
      .expect(401);

    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(await followersOf(owner.id)).toHaveLength(2);
  });

  it('answers 403 USERNAME_REQUIRED for a signed-in User without a username', async () => {
    const noUsername = await createUser(spec.testApp.db, { username: null });
    await createUserFollow(spec.testApp.db, fan.id, noUsername.id);
    await signInAs(noUsername);

    const response = await spec.client
      .delete(`/v1/me/followers/${fan.id}`)
      .expect(403);

    expect(response.body).toMatchObject({ code: 'USERNAME_REQUIRED' });
    expect(await followersOf(noUsername.id)).toHaveLength(1);
  });

  it('answers 404 NOT_FOUND for an unknown follower and removes nothing', async () => {
    const response = await spec.client
      .delete('/v1/me/followers/nobody')
      .expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(await followersOf(owner.id)).toHaveLength(2);
  });

  it('answers 400 VALIDATION_FAILED for a User ID that is too long', async () => {
    const response = await spec.client
      .delete(`/v1/me/followers/${'x'.repeat(129)}`)
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { location: 'param' },
    });
  });

  it('removes the follow of the follower and answers 204 with no body', async () => {
    const response = await spec.client
      .delete(`/v1/me/followers/${fan.id}`)
      .expect(204);

    expect(response.body).toEqual({});
    expect(await followersOf(owner.id)).toEqual([{ followerId: other.id }]);
  });

  it('answers 204 for a User who is not following, and changes nothing', async () => {
    await spec.client.delete(`/v1/me/followers/${fan.id}`).expect(204);
    await spec.client.delete(`/v1/me/followers/${fan.id}`).expect(204);

    expect(await followersOf(owner.id)).toEqual([{ followerId: other.id }]);
  });

  it('lets the removed User follow again later', async () => {
    await spec.client.delete(`/v1/me/followers/${fan.id}`).expect(204);
    await signInAs(fan);

    await spec.client.put(`/v1/me/following/${owner.id}`).expect(204);

    expect(await followersOf(owner.id)).toHaveLength(2);
  });

  it('drops the follower from the Profile counts', async () => {
    await spec.client.delete(`/v1/me/followers/${fan.id}`).expect(204);

    const response = await request(spec.testApp.app.getHttpServer())
      .get('/v1/users/ada')
      .expect(200);

    expect(publicProfileSchema.parse(response.body).followersCount).toBe(1);
  });
});
