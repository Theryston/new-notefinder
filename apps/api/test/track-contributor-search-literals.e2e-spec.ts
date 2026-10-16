import { trackContributorsPageSchema } from '@notefinder/contracts';
import { trackContributors } from '../src/database/schema/track-contributors.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createUser } from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

describe('Track contributor literal search (e2e)', () => {
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

  it('matches underscores, percent signs and backslashes literally', async () => {
    const track = await createCompletedTrack(testApp.db);
    const users = await Promise.all([
      createUser(testApp.db, {
        username: 'ana_souza',
        name: 'Ana Souza',
      }),
      createUser(testApp.db, {
        username: 'percent_singer',
        name: 'Singer 100% Voice',
      }),
      createUser(testApp.db, {
        username: 'slash_singer',
        name: 'Backslash\\Singer',
      }),
    ]);
    await testApp.db
      .insert(trackContributors)
      .values(users.map((user) => ({ trackId: track.id, userId: user.id })));

    for (const [query, expectedUsername] of [
      ['ana_souza', 'ana_souza'],
      ['100%', 'percent_singer'],
      ['\\', 'slash_singer'],
    ] as const) {
      const response = await testApp.http
        .get(
          `/v1/tracks/${track.id}/contributors?${new URLSearchParams({ q: query })}`,
        )
        .expect(200);
      const page = trackContributorsPageSchema.parse(response.body);

      expect(page.items.map((item) => item.username)).toEqual([
        expectedUsername,
      ]);
      expect(page.total).toBe(1);
    }
  });
});
