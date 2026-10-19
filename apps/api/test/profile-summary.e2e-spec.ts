import { publicProfileSummarySchema } from '@notefinder/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createTrack,
  createTrackFavorite,
  createUser,
} from './utils/factories.js';
import {
  createCompletedDay,
  createContributions,
  createPracticeAttempt,
} from './utils/profile-summary-factories.js';

/** Today's calendar day (`YYYY-MM-DD`) in `timeZone`, or in UTC when none. */
const todayIn = (timeZone = 'UTC'): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

/** The calendar day before `day`; pure arithmetic, no time zone involved. */
const dayBefore = (day: string): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

// The Summary section of a public Profile over a real Postgres: the four
// numbers a visitor sees, with the stat rules (bleed-suspected runs are not
// sung, every kind of Contribution counts) and the same 404 as the banner.
//
// Streak days are seeded as runs that end today, so they do not depend on
// the exact instant. A run of two days ending today reads as 2 even when the
// server's clock crosses midnight before the request: the run then ends
// yesterday, which still counts.
describe('GET /v1/users/:username/summary (e2e)', () => {
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

  it('answers zeros for a User with no practice, favorites or contributions', async () => {
    await createUser(testApp.db, { username: 'quiet_singer' });

    const response = await testApp.http
      .get('/v1/users/quiet_singer/summary')
      .expect(200);

    expect(publicProfileSummarySchema.parse(response.body)).toEqual({
      streakDays: 0,
      sungCount: 0,
      favoritesCount: 0,
      contributionsCount: 0,
    });
  });

  it('counts the streak, sung runs, favorites and contributions of the User', async () => {
    const user = await createUser(testApp.db, { username: 'ada_lovelace' });
    const track = await createTrack(testApp.db);
    const otherTrack = await createTrack(testApp.db);
    const today = todayIn();
    await createCompletedDay(testApp.db, user.id, today);
    await createCompletedDay(testApp.db, user.id, dayBefore(today));
    // Three days back is not part of the run: a gap ends it.
    await createCompletedDay(
      testApp.db,
      user.id,
      dayBefore(dayBefore(dayBefore(today))),
    );
    await createPracticeAttempt(testApp.db, user.id, track.id);
    await createPracticeAttempt(testApp.db, user.id, track.id, {
      difficulty: 'HARD',
    });
    await createTrackFavorite(testApp.db, user.id, track.id);
    await createTrackFavorite(testApp.db, user.id, otherTrack.id);
    await createContributions(testApp.db, {
      user,
      track,
      count: 2,
      kind: 'CREATE',
    });
    await createContributions(testApp.db, {
      user,
      track: otherTrack,
      count: 1,
      kind: 'RETRY',
    });

    const response = await testApp.http
      .get('/v1/users/ada_lovelace/summary')
      .expect(200);

    expect(response.body).toEqual({
      streakDays: 2,
      sungCount: 2,
      favoritesCount: 2,
      contributionsCount: 3,
    });
  });

  it("reads the streak in the owner's stored time zone, not in UTC", async () => {
    // Kiritimati is UTC+14, so its calendar day is often a day ahead of UTC.
    const zone = 'Pacific/Kiritimati';
    const user = await createUser(testApp.db, {
      username: 'kiri_singer',
      timeZone: zone,
    });
    const today = todayIn(zone);
    await createCompletedDay(testApp.db, user.id, today);
    await createCompletedDay(testApp.db, user.id, dayBefore(today));

    const response = await testApp.http
      .get('/v1/users/kiri_singer/summary')
      .expect(200);

    expect(response.body).toMatchObject({ streakDays: 2 });
  });

  it('falls back to UTC days for a User who never practiced in a zone', async () => {
    const user = await createUser(testApp.db, {
      username: 'utc_singer',
      timeZone: null,
    });
    const today = todayIn();
    await createCompletedDay(testApp.db, user.id, today);
    await createCompletedDay(testApp.db, user.id, dayBefore(today));

    const response = await testApp.http
      .get('/v1/users/utc_singer/summary')
      .expect(200);

    expect(response.body).toMatchObject({ streakDays: 2 });
  });

  it('leaves bleed-suspected runs out of Sung', async () => {
    const user = await createUser(testApp.db, { username: 'bleed_check' });
    const track = await createTrack(testApp.db);
    await createPracticeAttempt(testApp.db, user.id, track.id);
    await createPracticeAttempt(testApp.db, user.id, track.id, {
      bleedSuspected: true,
    });
    await createPracticeAttempt(testApp.db, user.id, track.id, {
      bleedSuspected: true,
    });

    const response = await testApp.http
      .get('/v1/users/bleed_check/summary')
      .expect(200);

    expect(response.body).toMatchObject({ sungCount: 1 });
  });

  it("does not count another User's runs, favorites or contributions", async () => {
    const author = await createUser(testApp.db, { username: 'author' });
    await createUser(testApp.db, { username: 'reader' });
    const track = await createTrack(testApp.db);
    await createPracticeAttempt(testApp.db, author.id, track.id);
    await createTrackFavorite(testApp.db, author.id, track.id);
    await createContributions(testApp.db, { user: author, track, count: 1 });
    await createCompletedDay(testApp.db, author.id, todayIn());

    const response = await testApp.http
      .get('/v1/users/reader/summary')
      .expect(200);

    expect(response.body).toEqual({
      streakDays: 0,
      sungCount: 0,
      favoritesCount: 0,
      contributionsCount: 0,
    });
  });

  it('finds the Profile whatever the casing of the username', async () => {
    await createUser(testApp.db, { username: 'grace' });

    const response = await testApp.http
      .get('/v1/users/GRACE/summary')
      .expect(200);

    expect(response.body).toHaveProperty('sungCount', 0);
  });

  it('answers NOT_FOUND for a username no User has', async () => {
    const response = await testApp.http
      .get('/v1/users/nobody/summary')
      .expect(404);

    expect(response.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});
