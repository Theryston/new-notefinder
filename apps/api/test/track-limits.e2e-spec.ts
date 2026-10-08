import type { TrackProcessingStatus } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import { trackProcessings } from '../src/database/schema/track-processings.js';
import { tracks } from '../src/database/schema/tracks.js';
import { type AuthClient, createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createPasswordUser,
  createTrack,
  DEFAULT_PASSWORD,
  testMbid,
  type User,
} from './utils/factories.js';
import {
  FAKE_CATALOG_API_KEY,
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from './utils/fake-music-catalog.js';
import { recordingFixture } from './utils/recording-fixtures.js';
import {
  createTrackContribution,
  createTrackContributor,
  createTrackProcessing,
} from './utils/track-processing-factories.js';

// The per-User limits on POST /v1/tracks (CONTEXT.md "Processing"). The
// Recordings a spec asks for are testMbid(1..40); Tracks seeded straight into
// the database take testMbid(900..), so the two never collide.

let catalog: FakeMusicCatalog;
let seeded = 0;

/** The catalog knows every Recording these specs ask for. */
const catalogEnv = () => ({
  MUSIC_CATALOG_URL: catalog.url,
  MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
  MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 1_000,
});

const signedInClient = async (
  testApp: TestApp,
  user: User,
): Promise<AuthClient> => {
  const client = createAuthClient(testApp);
  await signIn(client, {
    email: user.email,
    password: DEFAULT_PASSWORD,
  }).expect(200);
  return client;
};

const requestTrack = (client: AuthClient, n: number) =>
  client.post('/v1/tracks').send({ recordingMbid: testMbid(n), locale: 'en' });

/** The first instant of the UTC day that contains now. */
const startOfUtcToday = (): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

/**
 * A Track that the User created (a CREATE Contribution) at `createdAt`, with
 * its Processing in `status`. Completed by default, so it doesn't count as
 * active; seeded Tracks only fill the daily count.
 */
const seedCreatedTrack = async (
  testApp: TestApp,
  userId: string,
  options: { status?: TrackProcessingStatus; createdAt?: Date } = {},
): Promise<void> => {
  seeded += 1;
  const track = await createTrack(testApp.db, {
    recordingMbid: testMbid(900 + seeded),
  });
  const processing = await createTrackProcessing(testApp.db, track.id, {
    status: options.status ?? 'COMPLETED',
  });
  const contributor = await createTrackContributor(
    testApp.db,
    track.id,
    userId,
  );
  await createTrackContribution(testApp.db, {
    contributorId: contributor.id,
    processingId: processing.id,
    createdAt: options.createdAt,
  });
};

const trackRowsOf = (testApp: TestApp, n: number) =>
  testApp.db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.recordingMbid, testMbid(n)));

const setProcessingStatus = (
  testApp: TestApp,
  trackId: string,
  status: TrackProcessingStatus,
) =>
  testApp.db
    .update(trackProcessings)
    .set({ status })
    .where(eq(trackProcessings.trackId, trackId));

describe('POST /v1/tracks limits (e2e)', () => {
  beforeAll(async () => {
    catalog = await startFakeMusicCatalog((payload) => ({
      result: recordingFixture({ mbid: String(payload.mbid) }),
    }));
  });

  afterAll(async () => {
    await catalog.close();
  });

  describe('with the default limits (3 active Processings, 20 new Tracks a UTC day)', () => {
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({ env: catalogEnv() });
    });

    afterAll(async () => {
      await testApp.close();
    });

    beforeEach(async () => {
      await resetDatabase(testApp.db);
    });

    it('admits three Processings at once and refuses the fourth with 429 and the active limit', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(testApp, user);
      for (const n of [1, 2, 3]) {
        await requestTrack(client, n).expect(202);
      }

      const response = await requestTrack(client, 4).expect(429);

      expect(response.body).toEqual({
        statusCode: 429,
        code: 'PROCESSING_LIMIT_REACHED',
        message: 'Track request limit reached',
        details: { limit: 'ACTIVE_PROCESSINGS', max: 3 },
      });
      expect(await trackRowsOf(testApp, 4)).toEqual([]);
    });

    it('frees a slot when one of the active Processings completes', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(testApp, user);
      for (const n of [1, 2, 3]) {
        await requestTrack(client, n).expect(202);
      }
      const [first] = await trackRowsOf(testApp, 1);
      await setProcessingStatus(testApp, first?.id ?? '', 'COMPLETED');

      await requestTrack(client, 4).expect(202);
    });

    it('frees a slot when one of the active Processings fails', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(testApp, user);
      for (const n of [1, 2, 3]) {
        await requestTrack(client, n).expect(202);
      }
      const [first] = await trackRowsOf(testApp, 1);
      await setProcessingStatus(testApp, first?.id ?? '', 'FAILED');

      await requestTrack(client, 4).expect(202);
    });

    it('counts only the Processings of the requesting User', async () => {
      const busy = await createPasswordUser(testApp.db);
      const other = await createPasswordUser(testApp.db);
      const busyClient = await signedInClient(testApp, busy);
      for (const n of [1, 2, 3]) {
        await requestTrack(busyClient, n).expect(202);
      }
      const otherClient = await signedInClient(testApp, other);

      await requestTrack(otherClient, 4).expect(202);
    });

    it('refuses the 21st new Track of the day with the daily limit', async () => {
      const user = await createPasswordUser(testApp.db);
      for (let i = 0; i < 20; i += 1) {
        await seedCreatedTrack(testApp, user.id, { createdAt: new Date() });
      }
      const client = await signedInClient(testApp, user);

      const response = await requestTrack(client, 1).expect(429);

      expect(response.body).toMatchObject({
        code: 'PROCESSING_LIMIT_REACHED',
        details: { limit: 'NEW_TRACKS_PER_DAY', max: 20 },
      });
    });

    it('does not count the new Tracks of the UTC day before', async () => {
      const user = await createPasswordUser(testApp.db);
      const lastMillisecondOfYesterday = new Date(
        startOfUtcToday().getTime() - 1,
      );
      for (let i = 0; i < 20; i += 1) {
        await seedCreatedTrack(testApp, user.id, {
          createdAt: lastMillisecondOfYesterday,
        });
      }
      const client = await signedInClient(testApp, user);

      await requestTrack(client, 1).expect(202);
    });

    it('counts the new Tracks from the first instant of the UTC day', async () => {
      const user = await createPasswordUser(testApp.db);
      const lastMillisecondOfYesterday = new Date(
        startOfUtcToday().getTime() - 1,
      );
      await seedCreatedTrack(testApp, user.id, {
        createdAt: lastMillisecondOfYesterday,
      });
      for (let i = 0; i < 19; i += 1) {
        await seedCreatedTrack(testApp, user.id, {
          createdAt: startOfUtcToday(),
        });
      }
      const client = await signedInClient(testApp, user);

      // 19 of today's 20 are used: the 20th may go ahead, the 21st may not.
      await requestTrack(client, 1).expect(202);
      const response = await requestTrack(client, 2).expect(429);
      expect(response.body).toMatchObject({
        details: { limit: 'NEW_TRACKS_PER_DAY', max: 20 },
      });
    });

    it('lets an ADMIN go past both limits', async () => {
      const admin = await createPasswordUser(testApp.db, { role: 'ADMIN' });
      for (let i = 0; i < 3; i += 1) {
        await seedCreatedTrack(testApp, admin.id, { status: 'QUEUED' });
      }
      for (let i = 0; i < 20; i += 1) {
        await seedCreatedTrack(testApp, admin.id, { createdAt: new Date() });
      }
      const client = await signedInClient(testApp, admin);

      await requestTrack(client, 1).expect(202);
    });

    it('answers a Recording that already has a Track with 200 even at the limit', async () => {
      const user = await createPasswordUser(testApp.db);
      for (let i = 0; i < 3; i += 1) {
        await seedCreatedTrack(testApp, user.id, { status: 'QUEUED' });
      }
      const existing = await createTrack(testApp.db, {
        recordingMbid: testMbid(1),
      });
      const client = await signedInClient(testApp, user);

      const response = await requestTrack(client, 1).expect(200);

      expect(response.body).toEqual({ trackId: existing.id });
    });
  });

  describe('with PROCESSING_ACTIVE_LIMIT=1', () => {
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({
        env: { ...catalogEnv(), PROCESSING_ACTIVE_LIMIT: 1 },
      });
    });

    afterAll(async () => {
      await testApp.close();
    });

    beforeEach(async () => {
      await resetDatabase(testApp.db);
    });

    it('applies the limit the env sets', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(testApp, user);
      await requestTrack(client, 1).expect(202);

      const response = await requestTrack(client, 2).expect(429);

      expect(response.body).toMatchObject({
        details: { limit: 'ACTIVE_PROCESSINGS', max: 1 },
      });
    });

    it('admits one of five simultaneous requests for the last free slot', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(testApp, user);

      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map((n) => requestTrack(client, n)),
      );

      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 202)).toHaveLength(1);
      expect(statuses.filter((status) => status === 429)).toHaveLength(4);
      expect(await testApp.db.select().from(trackProcessings)).toHaveLength(1);
    });
  });
});
