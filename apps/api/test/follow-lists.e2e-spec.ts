import { type FollowListPage, followListPageSchema } from '@vozzify/contracts';
import { userFollows } from '../src/database/schema/user-follows.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createUser, type User } from './utils/factories.js';

// GET /v1/users/:username/{followers,following,friends} is anonymous, like the
// Profile banner. Each lists Users newest follow first, paginated by an opaque
// cursor, and an unknown username answers NOT_FOUND.
describe('Follow lists (e2e)', () => {
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

  const named = (username: string, name: string) =>
    createUser(testApp.db, { username, name });

  // Inserts a follow at a fixed time, so the order under test is the stored one.
  const follow = (followerId: string, followingId: string, at: string) =>
    testApp.db.insert(userFollows).values({
      followerId,
      followingId,
      createdAt: new Date(at),
    });

  const getList = async (
    side: 'followers' | 'following' | 'friends',
    username: string,
    query = '',
  ) => {
    const response = await testApp.http
      .get(`/v1/users/${username}/${side}${query}`)
      .expect(200);
    return followListPageSchema.parse(response.body);
  };

  const namesOf = (page: FollowListPage) => page.items.map((item) => item.name);

  describe('followers', () => {
    it('lists the Users who follow the Profile, newest follow first, with the public summary only', async () => {
      const ada = await createUser(testApp.db, { username: 'ada' });
      const grace = await named('grace', 'Grace');
      const linus = await named('linus', 'Linus');
      await follow(grace.id, ada.id, '2026-01-01T00:00:00.000Z');
      await follow(linus.id, ada.id, '2026-01-02T00:00:00.000Z');

      const page = await getList('followers', 'ada');

      expect(page.items).toEqual([
        { id: linus.id, username: 'linus', name: 'Linus', image: null },
        { id: grace.id, username: 'grace', name: 'Grace', image: null },
      ]);
      expect(page.nextCursor).toBeNull();
    });

    it('pages through every follower once, with ties on the same time', async () => {
      const ada = await createUser(testApp.db, { username: 'ada' });
      const same = '2026-01-01T00:00:00.000Z';
      const fans: User[] = [];
      for (let index = 0; index < 5; index += 1) {
        const fan = await createUser(testApp.db, {
          name: `Fan ${index}`,
        });
        fans.push(fan);
        await follow(fan.id, ada.id, same);
      }

      const first = await getList('followers', 'ada', '?limit=2');
      const second = await getList(
        'followers',
        'ada',
        `?limit=2&cursor=${first.nextCursor}`,
      );
      const third = await getList(
        'followers',
        'ada',
        `?limit=2&cursor=${second.nextCursor}`,
      );

      expect(first.items).toHaveLength(2);
      expect(second.items).toHaveLength(2);
      expect(third.items).toHaveLength(1);
      expect(third.nextCursor).toBeNull();
      const seen = [...first.items, ...second.items, ...third.items].map(
        (item) => item.id,
      );
      expect(new Set(seen)).toEqual(new Set(fans.map((fan) => fan.id)));
      expect(seen).toHaveLength(5);
    });

    it('answers a User without a username as a row with no username', async () => {
      const ada = await createUser(testApp.db, { username: 'ada' });
      const nameless = await createUser(testApp.db, {
        username: null,
        name: 'Nameless',
      });
      await follow(nameless.id, ada.id, '2026-01-01T00:00:00.000Z');

      const page = await getList('followers', 'ada');

      expect(page.items).toEqual([
        { id: nameless.id, username: null, name: 'Nameless', image: null },
      ]);
    });
  });

  describe('following', () => {
    it('lists the Users the Profile follows, newest follow first', async () => {
      const ada = await createUser(testApp.db, { username: 'ada' });
      const grace = await named('grace', 'Grace');
      const linus = await named('linus', 'Linus');
      await follow(ada.id, grace.id, '2026-01-01T00:00:00.000Z');
      await follow(ada.id, linus.id, '2026-01-02T00:00:00.000Z');
      await follow(grace.id, ada.id, '2026-01-03T00:00:00.000Z');

      const page = await getList('following', 'ada');

      expect(namesOf(page)).toEqual(['Linus', 'Grace']);
    });
  });

  describe('friends', () => {
    it('lists only mutual follows: a one-way follow does not appear', async () => {
      const ada = await createUser(testApp.db, { username: 'ada' });
      const grace = await named('grace', 'Grace');
      const linus = await named('linus', 'Linus');
      // Mutual with Ada: she follows Grace and Grace follows her back.
      await follow(ada.id, grace.id, '2026-01-01T00:00:00.000Z');
      await follow(grace.id, ada.id, '2026-01-01T00:00:00.000Z');
      // One-way: Ada follows Linus, who does not follow her back.
      await follow(ada.id, linus.id, '2026-01-02T00:00:00.000Z');
      // Linus follows Ada, but Ada does not follow him back: no friendship.

      const page = await getList('friends', 'ada');

      expect(page.items.map((item) => item.id)).toEqual([grace.id]);
    });

    it("orders the friends by the Profile's own follow, newest first", async () => {
      const ada = await createUser(testApp.db, { username: 'ada' });
      const grace = await named('grace', 'Grace');
      const linus = await named('linus', 'Linus');
      await follow(ada.id, grace.id, '2026-01-01T00:00:00.000Z');
      await follow(grace.id, ada.id, '2026-01-05T00:00:00.000Z');
      await follow(ada.id, linus.id, '2026-01-03T00:00:00.000Z');
      await follow(linus.id, ada.id, '2026-01-04T00:00:00.000Z');

      const page = await getList('friends', 'ada', '?limit=1');
      const next = await getList(
        'friends',
        'ada',
        `?limit=1&cursor=${page.nextCursor}`,
      );

      expect(namesOf(page)).toEqual(['Linus']);
      expect(namesOf(next)).toEqual(['Grace']);
      expect(next.nextCursor).toBeNull();
    });
  });

  describe.each(['followers', 'following', 'friends'] as const)(
    'GET /v1/users/:username/%s',
    (side) => {
      it('answers 404 NOT_FOUND for an unknown username', async () => {
        const response = await testApp.http
          .get(`/v1/users/nobody/${side}`)
          .expect(404);

        expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
      });

      it('matches the username in any casing', async () => {
        await createUser(testApp.db, { username: 'ada' });

        const page = await getList(side, 'ADA');

        expect(page.items).toEqual([]);
      });

      it('answers 400 VALIDATION_FAILED for a cursor it did not issue', async () => {
        await createUser(testApp.db, { username: 'ada' });

        const response = await testApp.http
          .get(`/v1/users/ada/${side}?cursor=not-a-cursor`)
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });
    },
  );
});
