import { publicProfileSchema } from '@notefinder/contracts';
import { eq, or } from 'drizzle-orm';
import { userFollows } from '../src/database/schema/user-follows.js';
import { users } from '../src/database/schema/users.js';
import { useAuthSpec } from './utils/auth-spec.js';
import { createUser, createUserFollow, type User } from './utils/factories.js';

// Deleting a User's row is what deleting an account does to the users table.
// The follows of that User must go with it, in both directions, and the counts
// of the Users they were related to must drop by one per removed follow.
describe('Account deletion removes follows (e2e)', () => {
  const spec = useAuthSpec();

  const countsByUsername = async (usernames: readonly string[]) => {
    const entries = await Promise.all(
      usernames.map(async (username) => {
        const response = await spec.client
          .get(`/v1/users/${username}`)
          .expect(200);
        const profile = publicProfileSchema.parse(response.body);
        return [
          username,
          {
            followers: profile.followersCount,
            following: profile.followingCount,
            friends: profile.friendsCount,
          },
        ] as const;
      }),
    );
    return Object.fromEntries(entries);
  };

  const followRowsOf = (userId: string) =>
    spec.testApp.db
      .select()
      .from(userFollows)
      .where(
        or(
          eq(userFollows.followerId, userId),
          eq(userFollows.followingId, userId),
        ),
      );

  const deleteAccount = (user: User) =>
    spec.testApp.db.delete(users).where(eq(users.id, user.id));

  it('removes the follows where the deleted User is the follower or the followee', async () => {
    const db = spec.testApp.db;
    const grace = await createUser(db, { username: 'grace' });
    const ada = await createUser(db, { username: 'ada' });
    const katherine = await createUser(db, { username: 'katherine' });
    await createUserFollow(db, grace.id, ada.id);
    await createUserFollow(db, ada.id, grace.id);
    await createUserFollow(db, katherine.id, grace.id);
    await createUserFollow(db, grace.id, katherine.id);

    await deleteAccount(grace);

    await expect(followRowsOf(grace.id)).resolves.toEqual([]);
    await expect(db.select().from(userFollows)).resolves.toEqual([]);
  });

  it('lowers the counts of the related Users by one per removed follow', async () => {
    const db = spec.testApp.db;
    const grace = await createUser(db, { username: 'grace' });
    const ada = await createUser(db, { username: 'ada' });
    const katherine = await createUser(db, { username: 'katherine' });
    const linus = await createUser(db, { username: 'linus' });
    await createUserFollow(db, grace.id, ada.id);
    await createUserFollow(db, ada.id, grace.id);
    await createUserFollow(db, katherine.id, grace.id);
    await createUserFollow(db, grace.id, linus.id);
    await createUserFollow(db, katherine.id, ada.id);
    const related = ['ada', 'katherine', 'linus'];

    await expect(countsByUsername(related)).resolves.toEqual({
      ada: { followers: 2, following: 1, friends: 1 },
      katherine: { followers: 0, following: 2, friends: 0 },
      linus: { followers: 1, following: 0, friends: 0 },
    });

    await deleteAccount(grace);

    await expect(countsByUsername(related)).resolves.toEqual({
      ada: { followers: 1, following: 0, friends: 0 },
      katherine: { followers: 0, following: 1, friends: 0 },
      linus: { followers: 0, following: 0, friends: 0 },
    });
  });
});
