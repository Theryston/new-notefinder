import { createTrackResultSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import {
  trackContributions,
  trackContributors,
} from '../src/database/schema/track-contributors.js';
import { trackProcessings } from '../src/database/schema/track-processings.js';
import {
  trackExternalLinks,
  trackReleases,
  tracks,
  trackTags,
  trackWorks,
} from '../src/database/schema/tracks.js';
import { users } from '../src/database/schema/users.js';
import { type AuthClient, createAuthClient, signIn } from './utils/auth.js';
import {
  type CreateTestAppOptions,
  createTestApp,
  type TestApp,
} from './utils/create-test-app.js';
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
  type FakeCatalogHandler,
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from './utils/fake-music-catalog.js';
import { recordingFixture } from './utils/recording-fixtures.js';

/** What the fake catalog answers for one MBID instead of the default. */
type CatalogAnswer = ReturnType<FakeCatalogHandler>;

// POST /v1/tracks end to end: the Recording is read from the Music catalog
// over its WebSocket, the Track and its first Processing are written in one
// unit, and a Recording that already has a Track answers without writing.
describe('POST /v1/tracks (e2e)', () => {
  let catalog: FakeMusicCatalog;
  let testApp: TestApp;
  // Recordings the catalog knows, and answers the catalog gives instead
  // (a merge, an outage, a slow reply), per MBID. Reset before each test.
  let recordings: Map<string, ReturnType<typeof recordingFixture>>;
  let overrides: Map<string, CatalogAnswer>;
  let catalogCalls: string[];

  const body = (mbid: string, locale = 'en') => ({
    recordingMbid: mbid,
    locale,
  });

  const signedInClient = async (user: User): Promise<AuthClient> => {
    const client = createAuthClient(testApp);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    return client;
  };

  const trackRowsOf = (mbid: string) =>
    testApp.db.select().from(tracks).where(eq(tracks.recordingMbid, mbid));

  /** The locale stored on a User's account. */
  const storedLocaleOf = async (userId: string) => {
    const [stored] = await testApp.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, userId));
    return stored;
  };

  /** A new signed-in User who requests the Track of a Recording (202). */
  const requestAsNewUser = async (mbid = testMbid(1)): Promise<User> => {
    const user = await createPasswordUser(testApp.db);
    const client = await signedInClient(user);
    await client.post('/v1/tracks').send(body(mbid)).expect(202);
    return user;
  };

  beforeAll(async () => {
    catalog = await startFakeMusicCatalog((payload) => {
      const mbid = String(payload.mbid);
      catalogCalls.push(mbid);
      const special = overrides.get(mbid);
      if (special !== undefined) {
        return special;
      }
      const recording = recordings.get(mbid);
      if (recording === undefined) {
        return {
          error: { code: 'RECORDING_NOT_FOUND', message: 'No such Recording' },
        };
      }
      return { result: recording };
    });
    const options: Pick<CreateTestAppOptions, 'env'> = {
      env: {
        MUSIC_CATALOG_URL: catalog.url,
        MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
        MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 1_000,
      },
    };
    testApp = await createTestApp(options);
  });

  afterAll(async () => {
    await testApp.close();
    await catalog.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    recordings = new Map([
      [testMbid(1), recordingFixture({ mbid: testMbid(1) })],
    ]);
    overrides = new Map();
    catalogCalls = [];
  });

  describe('access', () => {
    it('refuses a request without a session with 401', async () => {
      const response = await createAuthClient(testApp)
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('asks a signed-in User without a username to pick one first', async () => {
      const user = await createPasswordUser(testApp.db, { username: null });
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(403);

      expect(response.body).toMatchObject({ code: 'USERNAME_REQUIRED' });
      expect(catalogCalls).toEqual([]);
    });

    it('refuses a body without a valid Recording or locale with 400', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send({ recordingMbid: 'not-an-mbid', locale: 'fr' })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(catalogCalls).toEqual([]);
    });
  });

  describe('a Recording without a Track', () => {
    it('creates the Track with its first Processing, answering 202 with its ID', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(202);

      const { trackId } = createTrackResultSchema.parse(response.body);
      const [track] = await trackRowsOf(testMbid(1));
      expect(track).toMatchObject({
        id: trackId,
        recordingMbid: testMbid(1),
        title: 'Bohemian Rhapsody',
        genres: ['rock'],
        coverUrl: null,
        youtubeVideoId: null,
      });
      const processings = await testApp.db
        .select()
        .from(trackProcessings)
        .where(eq(trackProcessings.trackId, trackId));
      expect(processings).toMatchObject([
        { status: 'QUEUED', failureCode: null, videoId: null },
      ]);
    });

    it('records the requesting User as Contributor through one CREATE Contribution', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      await client
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(202);

      const contributors = await testApp.db
        .select()
        .from(trackContributors)
        .where(eq(trackContributors.userId, user.id));
      expect(contributors).toHaveLength(1);
      const contributions = await testApp.db
        .select({ kind: trackContributions.kind })
        .from(trackContributions)
        .where(eq(trackContributions.contributorId, contributors[0]?.id ?? ''));
      expect(contributions).toEqual([{ kind: 'CREATE' }]);
    });

    it('writes the companion rows of the Recording: releases, works, tags and links', async () => {
      recordings.set(
        testMbid(1),
        recordingFixture({
          mbid: testMbid(1),
          releases: [
            {
              mbid: testMbid(101),
              title: 'A Night at the Opera',
              releaseGroup: { mbid: testMbid(201), primaryType: 'Album' },
              status: 'Official',
              date: '1975-11-21',
              country: 'GB',
              mediumPosition: 1,
              trackPosition: 11,
              coverArtUrl: 'https://coverartarchive.org/release/a/front-500',
            },
          ],
          works: [{ mbid: testMbid(60), title: 'Bohemian Rhapsody' }],
          tags: [{ name: 'classic rock', count: 4 }],
          externalUrls: [
            {
              url: 'https://musicbrainz.org/recording/x',
              linkType: 'musicbrainz',
            },
          ],
        }),
      );
      await requestAsNewUser();

      const [track] = await trackRowsOf(testMbid(1));
      const trackId = track?.id ?? '';
      expect(
        await testApp.db
          .select()
          .from(trackReleases)
          .where(eq(trackReleases.trackId, trackId)),
      ).toMatchObject([
        {
          mbid: testMbid(101),
          title: 'A Night at the Opera',
          year: 1975,
        },
      ]);
      expect(
        await testApp.db
          .select()
          .from(trackWorks)
          .where(eq(trackWorks.trackId, trackId)),
      ).toMatchObject([{ mbid: testMbid(60), title: 'Bohemian Rhapsody' }]);
      expect(
        await testApp.db
          .select()
          .from(trackTags)
          .where(eq(trackTags.trackId, trackId)),
      ).toMatchObject([{ name: 'classic rock', count: 4 }]);
      expect(
        await testApp.db
          .select()
          .from(trackExternalLinks)
          .where(eq(trackExternalLinks.trackId, trackId)),
      ).toMatchObject([
        { url: 'https://musicbrainz.org/recording/x', linkType: 'musicbrainz' },
      ]);
    });

    it('stores the artist credit of the Recording in credit order', async () => {
      recordings.set(
        testMbid(1),
        recordingFixture({
          mbid: testMbid(1),
          artistCredit: {
            name: 'Queen feat. David Bowie',
            artists: [
              {
                mbid: testMbid(70),
                name: 'Queen',
                creditedName: 'Queen',
                joinPhrase: ' feat. ',
              },
              {
                mbid: testMbid(71),
                name: 'David Bowie',
                creditedName: 'David Bowie',
                joinPhrase: '',
              },
            ],
          },
        }),
      );
      await requestAsNewUser();

      const [track] = await trackRowsOf(testMbid(1));
      expect(track?.artistCredit).toEqual([
        { name: 'Queen', joinPhrase: ' feat. ' },
        { name: 'David Bowie', joinPhrase: '' },
      ]);
    });

    it('stores the locale the User browses in on their account', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      await client
        .post('/v1/tracks')
        .send(body(testMbid(1), 'en'))
        .expect(202);

      expect(await storedLocaleOf(user.id)).toEqual({ locale: 'en' });
    });

    it('follows a merged Recording to the MBID it moved to', async () => {
      const merged = testMbid(2);
      overrides.set(testMbid(1), {
        error: {
          code: 'RECORDING_MOVED',
          message: 'Merged',
          newMbid: merged,
        },
      });
      recordings.set(merged, recordingFixture({ mbid: merged }));
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      await client
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(202);

      expect(await trackRowsOf(testMbid(1))).toEqual([]);
      expect(await trackRowsOf(merged)).toHaveLength(1);
    });

    it('answers a Recording the catalog does not know with 404 NOT_FOUND', async () => {
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send(body(testMbid(99)))
        .expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
      expect(await trackRowsOf(testMbid(99))).toEqual([]);
    });

    it('answers a catalog that is still starting with 503 SERVICE_UNAVAILABLE', async () => {
      overrides.set(testMbid(1), {
        error: { code: 'CATALOG_NOT_READY', message: 'Starting' },
      });
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(503);

      expect(response.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(await trackRowsOf(testMbid(1))).toEqual([]);
    });

    it('answers a catalog that is too slow with 504 GATEWAY_TIMEOUT', async () => {
      overrides.set(testMbid(1), {
        delayMs: 1_500,
        result: recordingFixture({ mbid: testMbid(1) }),
      });
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(504);

      expect(response.body).toMatchObject({ code: 'GATEWAY_TIMEOUT' });
    });
  });

  describe('a Recording that already has a Track', () => {
    it('answers 200 with that Track and writes nothing', async () => {
      const existing = await createTrack(testApp.db, {
        recordingMbid: testMbid(1),
      });
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send(body(testMbid(1), 'en'))
        .expect(200);

      expect(response.body).toEqual({ trackId: existing.id });
      expect(catalogCalls).toEqual([]);
      expect(await testApp.db.select().from(trackProcessings)).toEqual([]);
      expect(await storedLocaleOf(user.id)).toEqual({ locale: 'pt-BR' });
    });

    it('answers with the Track of the MBID a merged Recording moved to', async () => {
      const existing = await createTrack(testApp.db, {
        recordingMbid: testMbid(2),
      });
      overrides.set(testMbid(1), {
        error: {
          code: 'RECORDING_MOVED',
          message: 'Merged',
          newMbid: testMbid(2),
        },
      });
      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);

      const response = await client
        .post('/v1/tracks')
        .send(body(testMbid(1)))
        .expect(200);

      expect(response.body).toEqual({ trackId: existing.id });
      expect(await testApp.db.select().from(trackProcessings)).toEqual([]);
    });
  });

  it('ends concurrent requests for one Recording in one Track and one CREATE Contribution', async () => {
    const first = await createPasswordUser(testApp.db);
    const second = await createPasswordUser(testApp.db);
    const [firstClient, secondClient] = await Promise.all([
      signedInClient(first),
      signedInClient(second),
    ]);

    // Three requests from each User, all at once, for the same Recording.
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        (index % 2 === 0 ? firstClient : secondClient)
          .post('/v1/tracks')
          .send(body(testMbid(1))),
      ),
    );

    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 202)).toHaveLength(1);
    expect(statuses.filter((status) => status === 200)).toHaveLength(5);
    const trackIds = new Set(
      responses.map((response) => response.body.trackId),
    );
    expect(trackIds.size).toBe(1);
    expect(await trackRowsOf(testMbid(1))).toHaveLength(1);
    expect(await testApp.db.select().from(trackProcessings)).toHaveLength(1);
    expect(await testApp.db.select().from(trackContributions)).toHaveLength(1);
  });
});
