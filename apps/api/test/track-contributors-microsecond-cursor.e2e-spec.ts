import { trackContributorsPageSchema } from '@vozzify/contracts';
import { sql } from 'drizzle-orm';
import { trackContributors } from '../src/database/schema/track-contributors.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createUser } from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

describe('Track contributor timestamp cursor precision (e2e)', () => {
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

  it('keeps contributors created within one millisecond on the next page', async () => {
    const track = await createCompletedTrack(testApp.db);
    const firstUser = await createUser(testApp.db, {
      username: 'first_singer',
    });
    const secondUser = await createUser(testApp.db, {
      username: 'second_singer',
    });
    await testApp.db.insert(trackContributors).values([
      { id: 'z-contributor', trackId: track.id, userId: firstUser.id },
      { id: 'a-contributor', trackId: track.id, userId: secondUser.id },
    ]);
    await testApp.db.execute(sql`
      update track_contributors
      set created_at = case id
        when 'z-contributor' then '2026-10-01T12:00:00.000100Z'::timestamptz
        else '2026-10-01T12:00:00.000200Z'::timestamptz
      end
      where id in ('z-contributor', 'a-contributor')
    `);

    const firstResponse = await testApp.http
      .get(`/v1/tracks/${track.id}/contributors?limit=1`)
      .expect(200);
    const firstPage = trackContributorsPageSchema.parse(firstResponse.body);
    expect(firstPage.items.map((item) => item.username)).toEqual([
      'first_singer',
    ]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondResponse = await testApp.http
      .get(
        `/v1/tracks/${track.id}/contributors?limit=1&cursor=${firstPage.nextCursor}`,
      )
      .expect(200);
    const secondPage = trackContributorsPageSchema.parse(secondResponse.body);

    expect(secondPage.items.map((item) => item.username)).toEqual([
      'second_singer',
    ]);
    expect(secondPage.nextCursor).toBeNull();
  });
});
