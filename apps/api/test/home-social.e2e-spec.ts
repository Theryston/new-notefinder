import { eq } from 'drizzle-orm';
import { trackFavorites } from '../src/database/schema/track-favorites.js';
import { users } from '../src/database/schema/users.js';
import { HomeSocialService } from '../src/modules/home/home-social.service.js';
import { createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';
import {
  sharedInMemoryCache,
  withInMemoryCache,
} from './utils/in-memory-cache.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

describe('Personal home social rows (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ override: withInMemoryCache });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    sharedInMemoryCache.clear();
    await resetDatabase(testApp.db);
  });

  it('requires three common Tracks and excludes Profiles that hide both sections', async () => {
    const tracks = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createCompletedTrack(testApp.db, { title: `Social track ${index}` }),
      ),
    );
    const viewer = await createUser(testApp.db, {
      username: 'social_viewer',
      email: 'social-viewer@example.com',
    });
    await createCredentialAccount(testApp.db, viewer);
    const addFavorites = (userId: string, trackIds: string[]) =>
      testApp.db
        .insert(trackFavorites)
        .values(trackIds.map((trackId) => ({ userId, trackId })));
    await addFavorites(
      viewer.id,
      tracks.map((track) => track.id),
    );
    const client = createAuthClient(testApp);
    await signIn(client, {
      email: viewer.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);

    const people = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createUser(testApp.db, {
          username: `social_person_${index}`,
          email: `social-person-${index}@example.com`,
        }),
      ),
    );
    const hidden = await createUser(testApp.db, {
      username: 'social_hidden',
      email: 'social-hidden@example.com',
    });
    // Newer unrelated accounts must not crowd older people with overlap out
    // of the bounded batch candidate pool.
    await testApp.db.insert(users).values(
      Array.from({ length: 500 }, (_, index) => ({
        name: `Unrelated user ${index}`,
        email: `unrelated-${index}@example.com`,
        username: `unrelated_${index}`,
        emailVerified: true,
        updatedAt: new Date('2099-01-01T00:00:00.000Z'),
      })),
    );
    const trackIds = tracks.map((track) => track.id);
    await Promise.all(
      [...people, hidden].map((person) => addFavorites(person.id, trackIds)),
    );
    const tooFew = await createUser(testApp.db, {
      username: 'social_too_few',
      email: 'social-too-few@example.com',
    });
    await addFavorites(tooFew.id, trackIds.slice(0, 2));
    await testApp.app.get(HomeSocialService).refreshFor(viewer.id);
    await testApp.db
      .update(users)
      .set({ showPracticeHistorySection: false, showFavoritesSection: false })
      .where(eq(users.id, hidden.id));

    const response = await client.get('/v1/home').expect(200);
    const rows = response.body.rows as {
      id: string;
      layout: string;
      items?: { username: string; commonTracks: number }[];
    }[];
    const peopleRows = rows.filter((row) => row.layout === 'people');

    expect(peopleRows).toHaveLength(1);
    expect(peopleRows[0]).toMatchObject({
      id: 'people-who-sing-what-you-sing',
      layout: 'people',
    });
    expect(peopleRows[0]?.items).toHaveLength(6);
    expect(
      peopleRows[0]?.items?.every((person) => person.commonTracks === 3),
    ).toBe(true);
    expect(
      peopleRows[0]?.items?.some(
        (person) => person.username === 'social_hidden',
      ),
    ).toBe(false);
    expect(
      peopleRows[0]?.items?.some(
        (person) => person.username === 'social_too_few',
      ),
    ).toBe(false);
    expect(
      peopleRows[0]?.items?.some(
        (person) => person.username === 'social_viewer',
      ),
    ).toBe(false);
  });
});
