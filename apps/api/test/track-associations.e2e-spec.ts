import {
  createTrackResultSchema,
  musicCatalogTrackAssociationPayloadSchema,
} from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import { trackAssociationEvents } from '../src/database/schema/track-association-events.js';
import { tracks } from '../src/database/schema/tracks.js';
import { MusicCatalogClient } from '../src/integrations/music-catalog/music-catalog.client.js';
import { TRACK_ASSOCIATION_CLAIM_LEASE_MS } from '../src/modules/tracks/track-association.job.js';
import { TrackAssociationService } from '../src/modules/tracks/track-association.service.js';
import { TrackAssociationEventRepository } from '../src/modules/tracks/track-association-event.repository.js';
import { TrackProcessingRepository } from '../src/modules/tracks/track-processing.repository.js';
import { type AuthClient, createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createPasswordUser,
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

describe('Track association outbox (e2e)', () => {
  let catalog: FakeMusicCatalog;
  let testApp: TestApp;
  let associationOutage = false;
  let associationCalls = 0;
  let projectedTrackId: string | null = null;

  const signedInClient = async (user: User): Promise<AuthClient> => {
    const client = createAuthClient(testApp);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    return client;
  };

  beforeAll(async () => {
    catalog = await startFakeMusicCatalog((payload) => {
      if ('trackId' in payload) {
        const association =
          musicCatalogTrackAssociationPayloadSchema.parse(payload);
        associationCalls += 1;
        if (associationOutage) {
          return { error: { code: 'REIMPORT_SWITCHING', message: 'Retry.' } };
        }
        projectedTrackId = association.trackId;
        return { result: {} };
      }
      if ('query' in payload) {
        const recording = recordingFixture({ mbid: testMbid(1) });
        return {
          result: {
            results: [
              {
                mbid: recording.mbid,
                title: recording.title,
                artistCredit: recording.artistCredit.name,
                coverUrl: recording.releases[0]?.coverArtUrl ?? null,
                trackId: projectedTrackId,
              },
            ],
          },
        };
      }
      return { result: recordingFixture({ mbid: String(payload.mbid) }) };
    });
    testApp = await createTestApp({
      env: {
        MUSIC_CATALOG_URL: catalog.url,
        MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
        MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 1_000,
      },
    });
  });

  afterAll(async () => {
    await testApp.close();
    await catalog.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    associationOutage = false;
    associationCalls = 0;
    projectedTrackId = null;
  });

  it('links the Track in compact catalog search after delivery', async () => {
    const user = await createPasswordUser(testApp.db);
    const response = await (await signedInClient(user))
      .post('/v1/tracks')
      .send({ recordingMbid: testMbid(1), locale: 'en' })
      .expect(202);
    const { trackId } = createTrackResultSchema.parse(response.body);
    const client = testApp.app.get(MusicCatalogClient);

    expect(
      (
        await client.search({
          query: 'Bohemian Rhapsody',
          limit: 20,
          offset: 0,
        })
      ).results[0]?.trackId,
    ).toBeNull();
    await testApp.app.get(TrackAssociationService).dispatchPending();
    expect(
      (
        await client.search({
          query: 'Bohemian Rhapsody',
          limit: 20,
          offset: 0,
        })
      ).results[0]?.trackId,
    ).toBe(trackId);
    expect(catalog.seenAuth).toContain(`Bearer ${FAKE_CATALOG_API_KEY}`);
    const [event] = await testApp.db.select().from(trackAssociationEvents);
    expect(event?.deliveredAt).toBeInstanceOf(Date);
  });

  it('retries a committed event after catalog delivery becomes available', async () => {
    associationOutage = true;
    const user = await createPasswordUser(testApp.db);
    await (await signedInClient(user))
      .post('/v1/tracks')
      .send({ recordingMbid: testMbid(1), locale: 'en' })
      .expect(202);
    const firstAttemptAt = new Date(Date.now() + 1_000);
    const retryAt = new Date(firstAttemptAt.getTime() + 5_000);
    await testApp.app
      .get(TrackAssociationService)
      .dispatchPending(firstAttemptAt);
    let [event] = await testApp.db.select().from(trackAssociationEvents);
    expect(event).toMatchObject({ deliveredAt: null, attempts: 1 });
    expect(event?.nextAttemptAt).toEqual(retryAt);
    associationOutage = false;
    await testApp.app.get(TrackAssociationService).dispatchPending(retryAt);
    [event] = await testApp.db.select().from(trackAssociationEvents);
    expect(event?.deliveredAt).toBeInstanceOf(Date);
    expect(associationCalls).toBe(2);
  });

  it('recovers an acknowledged event after a worker restart', async () => {
    const user = await createPasswordUser(testApp.db);
    const response = await (await signedInClient(user))
      .post('/v1/tracks')
      .send({ recordingMbid: testMbid(1), locale: 'en' })
      .expect(202);
    const { trackId } = createTrackResultSchema.parse(response.body);
    const now = new Date(Date.now() + 1_000);
    const events = testApp.app.get(TrackAssociationEventRepository);
    const [claimed] = await events.claimPending(
      now,
      new Date(now.getTime() + TRACK_ASSOCIATION_CLAIM_LEASE_MS),
      1,
    );
    expect(claimed?.trackId).toBe(trackId);
    await testApp.app
      .get(MusicCatalogClient)
      .associateTrack({ mbid: testMbid(1), trackId });
    await testApp.app
      .get(TrackAssociationService)
      .dispatchPending(
        new Date(now.getTime() + TRACK_ASSOCIATION_CLAIM_LEASE_MS),
      );
    expect(associationCalls).toBe(2);
    expect(projectedTrackId).toBe(trackId);
    const [event] = await testApp.db.select().from(trackAssociationEvents);
    expect(event?.deliveredAt).toBeInstanceOf(Date);
  });

  it('rolls the outbox event back with a failed Track creation transaction', async () => {
    const user = await createPasswordUser(testApp.db);
    const client = await signedInClient(user);
    const insertion = vi
      .spyOn(
        testApp.app.get(TrackProcessingRepository),
        'insertQueuedProcessing',
      )
      .mockRejectedValue(new Error('Simulated processing insert failure'));
    await client
      .post('/v1/tracks')
      .send({ recordingMbid: testMbid(1), locale: 'en' })
      .expect(500);
    expect(
      await testApp.db
        .select()
        .from(tracks)
        .where(eq(tracks.recordingMbid, testMbid(1))),
    ).toEqual([]);
    expect(await testApp.db.select().from(trackAssociationEvents)).toEqual([]);
    insertion.mockRestore();
  });
});
