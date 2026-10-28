import { publicProfileSchema } from '@vozzify/contracts';
import { useAuthSpec } from './utils/auth-spec.js';
import { createUser, createUserFollow } from './utils/factories.js';

describe('Profile follow counts (e2e)', () => {
  const spec = useAuthSpec();

  const countsOf = async (username: string) => {
    const response = await spec.client.get(`/v1/users/${username}`).expect(200);
    const profile = publicProfileSchema.parse(response.body);
    return {
      followers: profile.followersCount,
      following: profile.followingCount,
      friends: profile.friendsCount,
    };
  };

  it('shows zero counts to a visitor when nobody follows anybody', async () => {
    await createUser(spec.testApp.db, { username: 'grace' });

    await expect(countsOf('grace')).resolves.toEqual({
      followers: 0,
      following: 0,
      friends: 0,
    });
  });

  it('counts the followers and the following of the User', async () => {
    const db = spec.testApp.db;
    const grace = await createUser(db, { username: 'grace' });
    const ada = await createUser(db, { username: 'ada' });
    const katherine = await createUser(db, { username: 'katherine' });
    await createUserFollow(db, ada.id, grace.id);
    await createUserFollow(db, katherine.id, grace.id);
    await createUserFollow(db, grace.id, ada.id);

    await expect(countsOf('grace')).resolves.toEqual({
      followers: 2,
      following: 1,
      friends: 1,
    });
  });

  it('counts a friend only when the follow is mutual', async () => {
    const db = spec.testApp.db;
    const grace = await createUser(db, { username: 'grace' });
    const ada = await createUser(db, { username: 'ada' });
    const katherine = await createUser(db, { username: 'katherine' });
    await createUserFollow(db, grace.id, ada.id);
    await createUserFollow(db, ada.id, grace.id);
    await createUserFollow(db, grace.id, katherine.id);

    await expect(countsOf('grace')).resolves.toEqual({
      followers: 1,
      following: 2,
      friends: 1,
    });
    await expect(countsOf('katherine')).resolves.toEqual({
      followers: 1,
      following: 0,
      friends: 0,
    });
  });

  it('shows the counts to anonymous visitors, who have no follow button', async () => {
    const db = spec.testApp.db;
    const grace = await createUser(db, { username: 'grace' });
    const ada = await createUser(db, { username: 'ada' });
    await createUserFollow(db, ada.id, grace.id);

    const response = await spec.client.get('/v1/users/grace').expect(200);

    expect(response.body).toMatchObject({
      followersCount: 1,
      followingCount: 0,
      friendsCount: 0,
    });
  });
});
