import { publicProfileSchema } from '@notefinder/contracts';
import type { Database } from '../src/database/database.js';
import { practiceAttempts } from '../src/database/schema/practice-attempts.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createArtist,
  createTrack,
  createUser,
  linkTrackArtist,
  type Track,
  type User,
} from './utils/factories.js';

// The three Profile chips over a real Postgres: the Daily target, the Vocal
// range of the User's accurate runs (transposed, with the exclusions) and the
// Most sung artist (valid runs only, ties to the most recent one). Chips with
// nothing to show are absent from the banner.
describe('GET /v1/users/:username chips (e2e)', () => {
  let testApp: TestApp;
  let db: Database;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = testApp.db;
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  const profileOf = async (username: string) => {
    const response = await testApp.http
      .get(`/v1/users/${username}`)
      .expect(200);
    expect(publicProfileSchema.parse(response.body)).toEqual(response.body);
    return response.body;
  };

  /** A saved run of `user` on `track`; the rules see every column. */
  const attempt = (
    user: User,
    track: Track,
    overrides: Partial<typeof practiceAttempts.$inferInsert> = {},
  ) =>
    db.insert(practiceAttempts).values({
      userId: user.id,
      trackId: track.id,
      difficulty: 'NORMAL',
      octaveMode: 'ANY',
      transposeSemitones: 0,
      speed: 1,
      accuracy: 0.9,
      coverage: 0.95,
      forwardSkip: false,
      bleedSuspected: false,
      startedAt: new Date('2026-10-01T10:00:00.000Z'),
      endedAt: new Date('2026-10-01T10:04:00.000Z'),
      createdAt: new Date('2026-10-01T10:05:00.000Z'),
      ...overrides,
    });

  describe('Daily target', () => {
    it('shows the preset the User picked', async () => {
      await createUser(db, {
        username: 'ada',
        dailyPracticeTargetSeconds: 900,
      });

      const body = await profileOf('ada');

      expect(body).toMatchObject({ dailyPracticeTargetSeconds: 900 });
    });

    it('is absent when the User never picked one', async () => {
      await createUser(db, {
        username: 'ada',
        dailyPracticeTargetSeconds: null,
      });

      const body = await profileOf('ada');

      expect(body).not.toHaveProperty('dailyPracticeTargetSeconds');
    });

    it('is absent when the stored value is not a preset', async () => {
      await createUser(db, {
        username: 'ada',
        dailyPracticeTargetSeconds: 420,
      });

      const body = await profileOf('ada');

      expect(body).not.toHaveProperty('dailyPracticeTargetSeconds');
    });
  });

  describe('Vocal range', () => {
    it('is absent for a User with no attempts, and every chip too', async () => {
      await createUser(db, { username: 'ada' });

      const body = await profileOf('ada');

      expect(body).not.toHaveProperty('vocalRange');
      expect(body).not.toHaveProperty('mostSungArtist');
    });

    it('spans the Tracks of the accurate runs, transposed by each run', async () => {
      const user = await createUser(db, { username: 'ada' });
      const low = await createTrack(db, {
        vocalRangeLowest: 48,
        vocalRangeHighest: 72,
      });
      const high = await createTrack(db, {
        vocalRangeLowest: 55,
        vocalRangeHighest: 76,
      });
      // Sung two semitones up, C3-C5 (48-72) becomes D3-D5 (50-74).
      await attempt(user, low, { transposeSemitones: 2, accuracy: 0.85 });
      // Sung four semitones down, G3-E5 (55-76) becomes D#3-C5 (51-72).
      await attempt(user, high, { transposeSemitones: -4 });

      const body = await profileOf('ada');

      expect(body).toMatchObject({
        vocalRange: { lowest: 50, highest: 74 },
      });
    });

    it('ignores runs under 85% accuracy, runs that skipped forward and suspected bleed', async () => {
      const user = await createUser(db, { username: 'ada' });
      const accurate = await createTrack(db, {
        vocalRangeLowest: 50,
        vocalRangeHighest: 60,
      });
      const wide = await createTrack(db, {
        vocalRangeLowest: 20,
        vocalRangeHighest: 100,
      });
      await attempt(user, accurate);
      await attempt(user, wide, { accuracy: 0.8499 });
      await attempt(user, wide, { forwardSkip: true });
      await attempt(user, wide, { bleedSuspected: true });

      const body = await profileOf('ada');

      expect(body).toMatchObject({ vocalRange: { lowest: 50, highest: 60 } });
    });

    it('ignores Tracks without a vocal range', async () => {
      const user = await createUser(db, { username: 'ada' });
      const instrumental = await createTrack(db);
      await attempt(user, instrumental);

      const body = await profileOf('ada');

      expect(body).not.toHaveProperty('vocalRange');
    });

    it('does not count other Users attempts', async () => {
      await createUser(db, { username: 'ada' });
      const grace = await createUser(db, { username: 'grace' });
      const track = await createTrack(db, {
        vocalRangeLowest: 50,
        vocalRangeHighest: 60,
      });
      await attempt(grace, track);

      const body = await profileOf('ada');

      expect(body).not.toHaveProperty('vocalRange');
    });
  });

  describe('Most sung artist', () => {
    it('is the artist with the most valid attempts', async () => {
      const user = await createUser(db, { username: 'ada' });
      const winner = await createArtist(db, { name: 'Winner' });
      const other = await createArtist(db, { name: 'Other' });
      const trackOfWinner = await createTrack(db);
      const trackOfOther = await createTrack(db);
      await linkTrackArtist(db, trackOfWinner.id, winner.id);
      await linkTrackArtist(db, trackOfOther.id, other.id);
      await attempt(user, trackOfWinner);
      await attempt(user, trackOfWinner, { accuracy: 0.1 });
      await attempt(user, trackOfOther);

      const body = await profileOf('ada');

      expect(body).toMatchObject({
        mostSungArtist: { id: winner.id, name: 'Winner' },
      });
    });

    it('does not count attempts with a suspected bleed', async () => {
      const user = await createUser(db, { username: 'ada' });
      const leaking = await createArtist(db, { name: 'Leaking' });
      const honest = await createArtist(db, { name: 'Honest' });
      const leakingTrack = await createTrack(db);
      const honestTrack = await createTrack(db);
      await linkTrackArtist(db, leakingTrack.id, leaking.id);
      await linkTrackArtist(db, honestTrack.id, honest.id);
      await attempt(user, leakingTrack, { bleedSuspected: true });
      await attempt(user, leakingTrack, { bleedSuspected: true });
      await attempt(user, honestTrack);

      const body = await profileOf('ada');

      expect(body).toMatchObject({
        mostSungArtist: { id: honest.id, name: 'Honest' },
      });
    });

    it('breaks a tie on the most recent attempt', async () => {
      const user = await createUser(db, { username: 'ada' });
      const older = await createArtist(db, { name: 'Older' });
      const newer = await createArtist(db, { name: 'Newer' });
      const olderTrack = await createTrack(db);
      const newerTrack = await createTrack(db);
      await linkTrackArtist(db, olderTrack.id, older.id);
      await linkTrackArtist(db, newerTrack.id, newer.id);
      await attempt(user, olderTrack, {
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      });
      await attempt(user, olderTrack, {
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
      });
      await attempt(user, newerTrack, {
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
      });
      await attempt(user, newerTrack, {
        createdAt: new Date('2026-10-04T10:00:00.000Z'),
      });

      const body = await profileOf('ada');

      expect(body).toMatchObject({
        mostSungArtist: { id: newer.id, name: 'Newer' },
      });
    });

    it('is absent when no valid attempt has a credited artist', async () => {
      const user = await createUser(db, { username: 'ada' });
      const track = await createTrack(db);
      await attempt(user, track, { bleedSuspected: true });

      const body = await profileOf('ada');

      expect(body).not.toHaveProperty('mostSungArtist');
    });
  });

  it('finds the chips whatever the casing of the username', async () => {
    const user = await createUser(db, { username: 'grace' });
    const track = await createTrack(db, {
      vocalRangeLowest: 50,
      vocalRangeHighest: 60,
    });
    await attempt(user, track);

    const body = await profileOf('GRACE');

    expect(body).toMatchObject({
      username: 'grace',
      vocalRange: { lowest: 50, highest: 60 },
    });
  });
});
