import {
  type TrackContributorsPage,
  trackContributorsPageSchema,
} from '@vozzify/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createUser } from './utils/factories.js';
import {
  createCompletedTrack,
  createLegacyTrackId,
  createTrackContributor,
} from './utils/track-processing-factories.js';

// Track Contributors over a real Postgres: first-contribution order with the
// total, cursor paging without repeats or skips, username/name search, and
// the unknown, legacy and bad-cursor answers.
describe('Track contributors (e2e)', () => {
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

  const getPage = async (
    trackId: string,
    query = '',
  ): Promise<TrackContributorsPage> => {
    const response = await testApp.http
      .get(`/v1/tracks/${trackId}/contributors${query}`)
      .expect(200);
    const page = trackContributorsPageSchema.parse(response.body);
    expect(page).toEqual(response.body);
    return page;
  };

  /** Five Contributors in a known order, by staggered creation. */
  const makeTrack = async () => {
    const track = await createCompletedTrack(testApp.db);
    const users = [];
    for (const name of ['Ada', 'Grace', 'Linus', 'Margaret', 'Ken']) {
      users.push(
        await createUser(testApp.db, {
          name: `${name} Lovelace`,
          username: `${name.toLowerCase()}_singer`,
        }),
      );
    }
    for (const user of users) {
      await createTrackContributor(testApp.db, track.id, user.id);
    }
    return { track, users };
  };

  it('lists the Contributors in first-contribution order with their total', async () => {
    const { track } = await makeTrack();

    const page = await getPage(track.id);

    expect(page.total).toBe(5);
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((item) => item.username)).toEqual([
      'ada_singer',
      'grace_singer',
      'linus_singer',
      'margaret_singer',
      'ken_singer',
    ]);
  });

  it('pages without repeating or skipping', async () => {
    const { track } = await makeTrack();

    const first = await getPage(track.id, '?limit=2');
    expect(first.items.map((item) => item.username)).toEqual([
      'ada_singer',
      'grace_singer',
    ]);
    expect(first.total).toBe(5);
    expect(first.nextCursor).not.toBeNull();

    const second = await getPage(
      track.id,
      `?limit=2&cursor=${first.nextCursor}`,
    );
    expect(second.items.map((item) => item.username)).toEqual([
      'linus_singer',
      'margaret_singer',
    ]);
    expect(second.nextCursor).not.toBeNull();

    const third = await getPage(
      track.id,
      `?limit=2&cursor=${second.nextCursor}`,
    );
    expect(third.items.map((item) => item.username)).toEqual(['ken_singer']);
    expect(third.nextCursor).toBeNull();
    expect(third.total).toBe(5);
  });

  it('searches usernames and display names, case-insensitively', async () => {
    const { track } = await makeTrack();

    const byUsername = await getPage(track.id, '?q=GRACE');
    expect(byUsername.items.map((item) => item.username)).toEqual([
      'grace_singer',
    ]);
    expect(byUsername.total).toBe(1);

    const byName = await getPage(track.id, '?q=lovelace');
    expect(byName.total).toBe(5);
  });

  it('answers 404 for an unknown Track', async () => {
    const response = await testApp.http
      .get('/v1/tracks/nope/contributors')
      .expect(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('redirects a legacy Track ID to its new ID', async () => {
    const { track } = await makeTrack();
    await createLegacyTrackId(testApp.db, track.id, 'legacy-boat');

    const response = await testApp.http
      .get('/v1/tracks/legacy-boat/contributors')
      .expect(404);
    expect(response.body).toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: track.id },
    });
  });

  it('refuses a tampered cursor with a validation error', async () => {
    const { track } = await makeTrack();

    const response = await testApp.http
      .get(`/v1/tracks/${track.id}/contributors?cursor=track-1`)
      .expect(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
