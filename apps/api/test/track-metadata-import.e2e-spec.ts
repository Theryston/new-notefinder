import { createTrackResultSchema, type Recording } from '@notefinder/contracts';
import { asc, eq } from 'drizzle-orm';
import {
  albumArtists,
  albumDiscs,
  albums,
  albumTracks,
} from '../src/database/schema/albums.js';
import { artists, trackArtists } from '../src/database/schema/artists.js';
import { CoverArtClient } from '../src/integrations/cover-art/cover-art.client.js';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import {
  importMetadataJobSchema,
  TRACK_METADATA_QUEUE,
} from '../src/modules/tracks/track-metadata.job.js';
import { TrackMetadataService } from '../src/modules/tracks/track-metadata.service.js';
import { TRACK_PROCESSING_QUEUE } from '../src/modules/tracks/track-processing.job.js';
import {
  artistFixture,
  queenAndBowieCredit,
  releaseGroupFixture,
  representativeMedium,
} from './utils/catalog-fixtures.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createPasswordUser, testMbid, type User } from './utils/factories.js';
import { FakeCoverArt } from './utils/fake-cover-art.js';
import {
  FAKE_CATALOG_API_KEY,
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from './utils/fake-music-catalog.js';
import { recordingFixture } from './utils/recording-fixtures.js';
import {
  coverImage,
  processingRowOf,
  signedInClient,
} from './utils/track-processing-harness.js';

// The metadata import of a requested Track, over a real Postgres and MinIO, with
// the Music catalog and the Cover Art Archive faked at their boundaries. Each
// job runs through the service its processor calls.

const RECORDING = testMbid(1);
const QUEEN = testMbid(41);
const BOWIE = testMbid(42);
/** A Night at the Opera: the Recording is on its representative release. */
const OPERA = testMbid(40);
const OPERA_RELEASE = testMbid(31);
/** Greatest Hits: the Recording is on it, but not on its representative release. */
const HITS = testMbid(50);
const HITS_RELEASE = testMbid(32);
const HITS_REPRESENTATIVE = testMbid(33);
/** The Recording's own place on Greatest Hits, which the import falls back to. */
const HITS_OWN_DISC = 2;
const HITS_OWN_TRACK = 3;

type CatalogError = { code: string; message: string };

const coverUrlOf = (releaseGroup: string): string =>
  `https://coverartarchive.org/release-group/${releaseGroup}/front-500`;

/** The Recording, on two release groups as the Music catalog lists it. */
const recording = (): Recording =>
  recordingFixture({
    mbid: RECORDING,
    artistCredit: {
      name: 'Queen',
      artists: [
        { mbid: QUEEN, name: 'Queen', creditedName: 'Queen', joinPhrase: '' },
      ],
    },
    releases: [
      {
        mbid: OPERA_RELEASE,
        title: 'A Night at the Opera',
        releaseGroup: { mbid: OPERA, primaryType: 'Album' },
        status: 'Official',
        date: '1975-11-21',
        country: 'GB',
        mediumPosition: 1,
        trackPosition: 11,
        coverArtUrl: `https://coverartarchive.org/release/${OPERA_RELEASE}/front-500`,
      },
      {
        mbid: HITS_RELEASE,
        title: 'Greatest Hits',
        releaseGroup: { mbid: HITS, primaryType: 'Album' },
        status: 'Official',
        date: '1981-10-26',
        country: 'GB',
        mediumPosition: HITS_OWN_DISC,
        trackPosition: HITS_OWN_TRACK,
        coverArtUrl: `https://coverartarchive.org/release/${HITS_RELEASE}/front-500`,
      },
    ],
  });

/** A User's request for the Recording, as the API sees it. */
const requestBody = { recordingMbid: RECORDING, locale: 'en' } as const;

/** The Artist rows, ordered by MBID, so two runs can be compared. */
const artistSnapshot = (testApp: TestApp) =>
  testApp.db
    .select({
      id: artists.id,
      mbid: artists.mbid,
      name: artists.name,
      genres: artists.genres,
    })
    .from(artists)
    .orderBy(asc(artists.mbid));

/** Every Album row with its header and cover, ordered by MBID. */
const albumSnapshot = (testApp: TestApp) =>
  testApp.db
    .select({
      id: albums.id,
      mbid: albums.mbid,
      title: albums.title,
      year: albums.year,
      genres: albums.genres,
      coverArtUrl: albums.coverArtUrl,
    })
    .from(albums)
    .orderBy(asc(albums.mbid));

/** Every Album placement, the artist credits and the discs, in a stable order. */
const placementSnapshot = async (testApp: TestApp) => ({
  placements: await testApp.db
    .select()
    .from(albumTracks)
    .orderBy(asc(albumTracks.albumId), asc(albumTracks.trackId)),
  credits: await testApp.db
    .select()
    .from(albumArtists)
    .orderBy(asc(albumArtists.albumId), asc(albumArtists.position)),
  discs: await testApp.db
    .select()
    .from(albumDiscs)
    .orderBy(asc(albumDiscs.albumId), asc(albumDiscs.position)),
});

describe('Track metadata import (e2e)', () => {
  let testApp: TestApp;
  let catalog: FakeMusicCatalog;
  let coverArt: FakeCoverArt;
  /** What the fake catalog answers by MBID; an error wins over an answer. */
  const answers = new Map<string, unknown>();
  const errors = new Map<string, CatalogError>();

  beforeAll(async () => {
    catalog = await startFakeMusicCatalog((payload) => {
      const mbid = String(payload.mbid);
      const error = errors.get(mbid);
      if (error !== undefined) {
        return { error };
      }
      if (answers.has(mbid)) {
        return { result: answers.get(mbid) };
      }
      return {
        error: { code: 'RECORDING_NOT_FOUND', message: 'No such Recording' },
      };
    });
    coverArt = new FakeCoverArt();
    testApp = await createTestApp({
      env: {
        MUSIC_CATALOG_URL: catalog.url,
        MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
        MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 1_000,
      },
      override: (builder) =>
        builder.overrideProvider(CoverArtClient).useValue(coverArt),
    });
  });

  afterAll(async () => {
    await testApp.close();
    await catalog.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    answers.clear();
    errors.clear();
    coverArt.reset();
    for (const name of [
      TRACK_METADATA_QUEUE,
      TRACK_PROCESSING_QUEUE,
      WEB_REVALIDATION_QUEUE,
    ]) {
      testApp.queues[name]?.added.splice(0);
    }
    answers.set(RECORDING, recording());
    answers.set(QUEEN, artistFixture({ mbid: QUEEN, name: 'Queen' }));
    answers.set(
      BOWIE,
      artistFixture({
        mbid: BOWIE,
        name: 'David Bowie',
        genres: [{ mbid: testMbid(62), name: 'art rock', count: 5 }],
      }),
    );
    answers.set(
      OPERA,
      releaseGroupFixture({
        mbid: OPERA,
        title: 'A Night at the Opera',
        firstReleaseYear: 1975,
        representativeRelease: {
          mbid: OPERA_RELEASE,
          title: 'A Night at the Opera',
          media: [
            representativeMedium(1, '', [testMbid(90), RECORDING]),
            representativeMedium(2, 'Bonus', []),
          ],
        },
      }),
    );
    // Credit order is not alphabetical on purpose: Queen is credited first.
    answers.set(
      HITS,
      releaseGroupFixture({
        mbid: HITS,
        title: 'Greatest Hits',
        primaryType: 'Album',
        firstReleaseYear: 1981,
        genres: [],
        artistCredit: queenAndBowieCredit(),
        representativeRelease: {
          mbid: HITS_REPRESENTATIVE,
          title: 'Greatest Hits',
          media: [representativeMedium(1, 'Disc 1', [testMbid(91)])],
        },
      }),
    );
    // The Cover Art Archive has a cover for Opera only; Greatest Hits has none.
    coverArt.images.set(coverUrlOf(OPERA), await coverImage());
  });

  /** A signed-in User requests the Recording; answers the Track's ID (202). */
  const requestTrack = async (user: User): Promise<string> => {
    const client = await signedInClient(testApp, user);
    const response = await client
      .post('/v1/tracks')
      .send(requestBody)
      .expect(202);
    return createTrackResultSchema.parse(response.body).trackId;
  };

  const requestNewTrack = async (): Promise<string> =>
    requestTrack(await createPasswordUser(testApp.db));

  /** Runs every queued import, as its processor does on the last attempt. */
  const runQueuedImports = async (): Promise<void> => {
    const service = testApp.app.get(TrackMetadataService);
    const queue = testApp.queues[TRACK_METADATA_QUEUE];
    for (
      let job = queue?.added.shift();
      job !== undefined;
      job = queue?.added.shift()
    ) {
      await service.run(importMetadataJobSchema.parse(job.data), true);
    }
  };

  const artistByMbid = async (mbid: string) =>
    (await testApp.db.select().from(artists).where(eq(artists.mbid, mbid)))[0];

  const albumByMbid = async (mbid: string) =>
    (await testApp.db.select().from(albums).where(eq(albums.mbid, mbid)))[0];

  it('queues the import when the request creates the Track', async () => {
    const trackId = await requestNewTrack();

    expect(testApp.queues[TRACK_METADATA_QUEUE]?.added).toEqual([
      { name: 'import-metadata', data: { trackId } },
    ]);
  });

  it('queues no import for a Recording that already has a Track', async () => {
    const user = await createPasswordUser(testApp.db);
    await requestTrack(user);
    testApp.queues[TRACK_METADATA_QUEUE]?.added.splice(0);
    const client = await signedInClient(testApp, user);

    await client.post('/v1/tracks').send(requestBody).expect(200);

    expect(testApp.queues[TRACK_METADATA_QUEUE]?.added).toEqual([]);
  });

  it('upserts the Artists of the Recording with their genres, linked to the Track', async () => {
    const trackId = await requestNewTrack();

    await runQueuedImports();

    const queen = await artistByMbid(QUEEN);
    expect(queen).toMatchObject({ name: 'Queen', genres: ['glam rock'] });
    const links = await testApp.db
      .select()
      .from(trackArtists)
      .where(eq(trackArtists.trackId, trackId));
    expect(links).toEqual([{ trackId, artistId: queen?.id }]);
  });

  it('writes each release group of the Recording as an Album, with its header from the catalog', async () => {
    await requestNewTrack();

    await runQueuedImports();

    expect(await albumByMbid(OPERA)).toMatchObject({
      title: 'A Night at the Opera',
      primaryType: 'Album',
      secondaryTypes: [],
      year: 1975,
      genres: ['rock'],
    });
    expect(await albumByMbid(HITS)).toMatchObject({
      title: 'Greatest Hits',
      year: 1981,
      genres: [],
    });
    expect(await testApp.db.select().from(albums)).toHaveLength(2);
  });

  it('credits the Album artists in credit order, not alphabetically', async () => {
    await requestNewTrack();

    await runQueuedImports();

    const hits = await albumByMbid(HITS);
    const credited = await testApp.db
      .select({ mbid: artists.mbid, position: albumArtists.position })
      .from(albumArtists)
      .innerJoin(artists, eq(albumArtists.artistId, artists.id))
      .where(eq(albumArtists.albumId, hits?.id ?? ''))
      .orderBy(asc(albumArtists.position));
    expect(credited).toEqual([
      { mbid: QUEEN, position: 0 },
      { mbid: BOWIE, position: 1 },
    ]);
  });

  it('places the Track at its place on the representative release, with that release discs', async () => {
    await requestNewTrack();

    await runQueuedImports();

    const opera = await albumByMbid(OPERA);
    const discs = await testApp.db
      .select()
      .from(albumDiscs)
      .where(eq(albumDiscs.albumId, opera?.id ?? ''))
      .orderBy(asc(albumDiscs.position));
    expect(discs).toEqual([
      expect.objectContaining({ position: 1, title: null }),
      expect.objectContaining({ position: 2, title: 'Bonus' }),
    ]);
    const placed = await testApp.db
      .select()
      .from(albumTracks)
      .where(eq(albumTracks.albumId, opera?.id ?? ''));
    // The Recording's own release says track 11; the representative one wins.
    expect(placed).toEqual([
      expect.objectContaining({ discPosition: 1, trackPosition: 2 }),
    ]);
  });

  it('places the Track from its own release when the representative release lacks it, creating the disc', async () => {
    await requestNewTrack();

    await runQueuedImports();

    const hits = await albumByMbid(HITS);
    const discs = await testApp.db
      .select()
      .from(albumDiscs)
      .where(eq(albumDiscs.albumId, hits?.id ?? ''))
      .orderBy(asc(albumDiscs.position));
    expect(discs).toEqual([
      expect.objectContaining({ position: 1, title: 'Disc 1' }),
      expect.objectContaining({ position: HITS_OWN_DISC, title: null }),
    ]);
    const placed = await testApp.db
      .select()
      .from(albumTracks)
      .where(eq(albumTracks.albumId, hits?.id ?? ''));
    expect(placed).toEqual([
      expect.objectContaining({
        discPosition: HITS_OWN_DISC,
        trackPosition: HITS_OWN_TRACK,
      }),
    ]);
  });

  it('stores the Album cover in our storage, and leaves it null when the archive has none', async () => {
    await requestNewTrack();

    await runQueuedImports();

    const opera = await albumByMbid(OPERA);
    expect(opera?.coverArtUrl).toEqual(
      expect.stringContaining('album-covers/'),
    );
    const stored = await fetch(opera?.coverArtUrl ?? '');
    expect(stored.status).toBe(200);
    expect(stored.headers.get('content-type')).toBe('image/webp');
    expect((await albumByMbid(HITS))?.coverArtUrl).toBeNull();
  });

  it('keeps every row unchanged when the import runs again', async () => {
    const trackId = await requestNewTrack();
    await runQueuedImports();
    const before = {
      artists: await artistSnapshot(testApp),
      albums: await albumSnapshot(testApp),
      placements: await placementSnapshot(testApp),
    };

    testApp.queues[TRACK_METADATA_QUEUE]?.added.splice(0);
    await testApp.app.get(TrackMetadataService).run({ trackId }, true);

    expect({
      artists: await artistSnapshot(testApp),
      albums: await albumSnapshot(testApp),
      placements: await placementSnapshot(testApp),
    }).toEqual(before);
  });

  it('leaves the Processing untouched when an import fails for good, and a later import completes', async () => {
    const trackId = await requestNewTrack();
    const queued = await processingRowOf(testApp, trackId);
    errors.set(OPERA, { code: 'INTERNAL', message: 'Database is down' });
    const service = testApp.app.get(TrackMetadataService);

    await expect(service.run({ trackId }, false)).rejects.toThrow();
    await expect(service.run({ trackId }, true)).resolves.toBeUndefined();

    expect(await processingRowOf(testApp, trackId)).toMatchObject({
      status: queued.status,
      failureCode: null,
      finishedAt: null,
    });

    errors.clear();
    await service.run({ trackId }, true);
    expect(await albumByMbid(OPERA)).toBeDefined();
  });
});
