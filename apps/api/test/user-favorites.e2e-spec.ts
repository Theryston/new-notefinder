import {
  type UserFavoritesPage,
  userFavoritesPageSchema,
} from '@notefinder/contracts';
import { trackFavorites } from '../src/database/schema/track-favorites.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createArtist,
  createTrack,
  createUser,
  linkTrackArtist,
} from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

// GET /v1/users/:username/favorites is anonymous: it lists a User's favorite
// Tracks with a completed Processing, newest favorited first, paginated by an
// opaque cursor. Unknown usernames answer NOT_FOUND, like the banner.
describe('User favorites (e2e)', () => {
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

  const favorite = (userId: string, trackId: string, favoritedAt: string) =>
    testApp.db.insert(trackFavorites).values({
      userId,
      trackId,
      createdAt: new Date(favoritedAt),
    });

  const listFavorites = async (username: string, query = '') => {
    const response = await testApp.http
      .get(`/v1/users/${username}/favorites${query}`)
      .expect(200);
    return userFavoritesPageSchema.parse(response.body);
  };

  const idsOf = (page: UserFavoritesPage) => page.items.map((item) => item.id);

  // A catalog Track always has an artist credit, which the listing requires.
  const completedTrack = async (overrides: { title?: string } = {}) => {
    const artist = await createArtist(testApp.db, { name: 'Queen' });
    const track = await createCompletedTrack(testApp.db, overrides);
    await linkTrackArtist(testApp.db, track.id, artist.id);
    return track;
  };

  it('lists favorites newest favorited first, with the Track core fields', async () => {
    const ada = await createUser(testApp.db, { username: 'ada' });
    const older = await completedTrack({ title: 'Older favorite' });
    const newer = await completedTrack({ title: 'Newer favorite' });
    await favorite(ada.id, older.id, '2026-01-01T00:00:00.000Z');
    await favorite(ada.id, newer.id, '2026-01-02T00:00:00.000Z');

    const page = await listFavorites('ada');

    expect(idsOf(page)).toEqual([newer.id, older.id]);
    expect(page.items[0]).toMatchObject({
      id: newer.id,
      title: 'Newer favorite',
    });
    expect(page.nextCursor).toBeNull();
  });

  it('pages through favorites with the cursor and never repeats one', async () => {
    const ada = await createUser(testApp.db, { username: 'ada' });
    const tracks = [];
    for (const day of [1, 2, 3, 4, 5]) {
      const track = await completedTrack();
      tracks.push(track);
      await favorite(ada.id, track.id, `2026-01-0${day}T00:00:00.000Z`);
    }
    const newestFirst = tracks.map((track) => track.id).reverse();

    const first = await listFavorites('ada', '?limit=2');
    const second = await listFavorites(
      'ada',
      `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    const third = await listFavorites(
      'ada',
      `?limit=2&cursor=${encodeURIComponent(second.nextCursor ?? '')}`,
    );

    expect(idsOf(first)).toEqual(newestFirst.slice(0, 2));
    expect(idsOf(second)).toEqual(newestFirst.slice(2, 4));
    expect(idsOf(third)).toEqual(newestFirst.slice(4));
    expect(third.nextCursor).toBeNull();
  });

  it('keeps a page boundary exact when favorites share a millisecond', async () => {
    const ada = await createUser(testApp.db, { username: 'ada' });
    const sameMoment = '2026-01-01T00:00:00.000Z';
    const first = await completedTrack();
    const second = await completedTrack();
    const third = await completedTrack();
    await favorite(ada.id, first.id, sameMoment);
    await favorite(ada.id, second.id, sameMoment);
    await favorite(ada.id, third.id, '2025-12-31T00:00:00.000Z');

    const page = await listFavorites('ada', '?limit=1');
    const rest = await listFavorites(
      'ada',
      `?limit=2&cursor=${encodeURIComponent(page.nextCursor ?? '')}`,
    );

    const allIds = [...idsOf(page), ...idsOf(rest)];
    expect(new Set(allIds)).toEqual(new Set([first.id, second.id, third.id]));
    expect(allIds).toHaveLength(3);
    expect(rest.nextCursor).toBeNull();
  });

  it('lists nothing for a Track whose Processing is not completed', async () => {
    const ada = await createUser(testApp.db, { username: 'ada' });
    const done = await completedTrack();
    const pending = await createTrack(testApp.db);
    await favorite(ada.id, done.id, '2026-01-01T00:00:00.000Z');
    await favorite(ada.id, pending.id, '2026-01-02T00:00:00.000Z');

    const page = await listFavorites('ada');

    expect(idsOf(page)).toEqual([done.id]);
  });

  it('keeps each User favorites apart', async () => {
    const ada = await createUser(testApp.db, { username: 'ada' });
    const grace = await createUser(testApp.db, { username: 'grace' });
    const track = await completedTrack();
    await favorite(grace.id, track.id, '2026-01-01T00:00:00.000Z');

    const page = await listFavorites(ada.username ?? 'ada');

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('answers an empty page for a User with no favorites', async () => {
    await createUser(testApp.db, { username: 'ada' });

    const page = await listFavorites('ada');

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('finds the favorites of any username casing', async () => {
    const ada = await createUser(testApp.db, { username: 'ada' });
    const track = await completedTrack();
    await favorite(ada.id, track.id, '2026-01-01T00:00:00.000Z');

    const page = await listFavorites('ADA');

    expect(idsOf(page)).toEqual([track.id]);
  });

  it('answers 404 NOT_FOUND for a username no User has', async () => {
    const response = await testApp.http
      .get('/v1/users/nobody/favorites')
      .expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers 400 VALIDATION_FAILED for a cursor it did not issue', async () => {
    await createUser(testApp.db, { username: 'ada' });

    const response = await testApp.http
      .get('/v1/users/ada/favorites?cursor=not-a-cursor')
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
