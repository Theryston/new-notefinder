import type { CatalogDataset } from '@notefinder/contracts';
import { musicCatalogStatusResponseSchema } from '@notefinder/contracts';
import { sql } from 'drizzle-orm';
import { inject } from 'vitest';
import { MbslaveClient } from '../src/integrations/mbslave/mbslave-client.js';
import { BootstrapRepository } from '../src/modules/bootstrap/bootstrap.repository.js';
import { resolveLatestDumpUrls } from '../src/modules/bootstrap/dump-urls.js';
import {
  RestoreService,
  restoreServiceDeps,
} from '../src/modules/bootstrap/restore.service.js';
import {
  TINY_RECORDING_COUNT,
  tinyRecordingMbid,
} from '../src/modules/bootstrap/tiny-seed.js';
import { TinySeedRepository } from '../src/modules/bootstrap/tiny-seed.repository.js';
import { applyMusicBrainzSchema } from './setup/musicbrainz-schema.js';
import { applySyncTriggers } from './setup/sync-triggers.js';
import { testLogger, useTestServer } from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import {
  type FakeDumpServer,
  startFakeDumpServer,
} from './utils/fake-dump-server.js';
import {
  fakeLrclibDumpGz,
  startFakeLrclibServer,
} from './utils/fake-lrclib-server.js';
import { requestRecording } from './utils/get-recording-client.js';
import { addRecording, mbid } from './utils/musicbrainz.js';
import { requestSearch } from './utils/search-client.js';
import {
  createTestWorker,
  useEmptyLyricsIndex,
  useEmptySearchIndex,
} from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';

// Recreating the 375-table MusicBrainz schema (the redo test) and
// indexing to ready take longer than vitest's 5s default on CI runners.
describe('first import: the mbslave container lays the dataset down (e2e)', {
  timeout: 120_000,
}, () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();
  useEmptyLyricsIndex();

  let dumps: FakeDumpServer;
  beforeAll(async () => {
    dumps = await startFakeDumpServer();
  });
  afterAll(async () => {
    await dumps.close();
  });
  beforeEach(() => {
    dumps.forgetRequests();
  });

  // The real restore wired like `restore.ts`, except mbslave runs behind its
  // integration boundary: `init --empty` recreates the schema the scripts
  // would create. In `tiny` mode the real seed then writes the deterministic
  // Recordings (no downloads); in `full` mode `import` downloads the
  // archives over real HTTP from the fake dump server and seeds what the
  // dump would load. Spawning the real binary here would need its
  // Python/psql image, minutes per run and the network on every PR; the
  // spike verified the real commands against a fake mirror instead
  // (docs/research/music-catalog-spike.md, section 2).
  const harness = async (
    options: {
      dataset?: CatalogDataset;
      seedMbid?: string;
      seedName?: string;
    } = {},
  ) => {
    const calls: string[][] = [];
    const dataset = options.dataset ?? 'tiny';
    const mbslave = new MbslaveClient(async (args) => {
      calls.push([...args]);
      if (args[0] === 'init') {
        await applyMusicBrainzSchema(inject('databaseUrl'));
        return;
      }
      for (const url of args.slice(1)) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `The fake dump server answered ${response.status} for ${url}`,
          );
        }
        await response.arrayBuffer();
      }
      await addRecording(server().db, {
        mbid: options.seedMbid ?? mbid(301),
        name: options.seedName ?? 'First Song',
      });
    });
    const restore = new RestoreService(
      restoreServiceDeps({
        repository: new BootstrapRepository(server().db),
        mbslave,
        resolveUrls: resolveLatestDumpUrls,
        seedTiny: () => new TinySeedRepository(server().db).seed(),
        baseUrl: dumps.url,
        dataset,
        logger: testLogger,
      }),
    );
    return { run: () => restore.run(), calls };
  };

  const statusOf = async (): Promise<{ phase: string; dataset: string }> => {
    const response = musicCatalogStatusResponseSchema.parse(
      await client().request('status', {}),
    );
    if (!response.ok) {
      throw new Error('status failed');
    }
    return response.result;
  };

  const searchMbids = async (
    query: string,
    scope?: 'metadata' | 'lyrics',
  ): Promise<string[]> => {
    const response = await requestSearch(client(), { query, scope });
    if (!response.ok) {
      throw new Error(`search failed: ${response.error.code}`);
    }
    return response.result.results.map((result) => result.mbid);
  };

  const recordingCount = async (): Promise<number> => {
    const rows = await server().db.execute<{ count: string }>(
      sql`select count(*) as count from musicbrainz.recording`,
    );
    return Number(rows.rows[0]?.count ?? 0);
  };

  it('seeds the tiny catalog to ready on the first run, downloading nothing', async () => {
    expect(await statusOf()).toMatchObject({
      phase: 'restoring',
      dataset: 'tiny',
    });
    await expect(
      requestSearch(client(), { query: 'tiny song' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'CATALOG_NOT_READY' },
    });

    const { run, calls } = await harness();
    await expect(run()).resolves.toBe('restored');

    // Same schema scripts, no dump layout: only `init --empty` ran, and no
    // HTTP request ever reached a dump server.
    expect(calls).toEqual([['init', '--empty']]);
    expect(dumps.requested).toEqual([]);
    expect(await recordingCount()).toBe(TINY_RECORDING_COUNT);
    expect(await statusOf()).toMatchObject({
      phase: 'restored',
      dataset: 'tiny',
    });

    await createTestWorker(server()).tick();

    expect(await statusOf()).toMatchObject({
      phase: 'ready',
      dataset: 'tiny',
    });
    const seededMbid = tinyRecordingMbid(1);
    await expect(searchMbids('Tiny Song 001')).resolves.toContain(seededMbid);
    // The tick generated the fake LRCLIB dump from the seeded Recordings
    // and kept only the matched Lyrics: recording 1 has them, recording 2
    // (an album tie) stays null.
    await expect(
      requestRecording(client(), { mbid: seededMbid }),
    ).resolves.toMatchObject({
      ok: true,
      result: {
        title: 'Tiny Song 001',
        lyrics: {
          plain: expect.stringContaining('fake-lrclib-0'),
          synced: expect.stringContaining('[00:01.00]'),
        },
      },
    });
    await expect(
      requestRecording(client(), { mbid: tinyRecordingMbid(2) }),
    ).resolves.toMatchObject({
      ok: true,
      result: { lyrics: { plain: null, synced: null } },
    });
    await expect(
      searchMbids('fake-lrclib-2 drifting', 'lyrics'),
    ).resolves.toContain(tinyRecordingMbid(3));
    // The metadata scope never matches on Lyrics.
    await expect(
      searchMbids('fake-lrclib-0 drifting', 'metadata'),
    ).resolves.toEqual([]);
  });

  it('restores the full dump to ready on the first run', async () => {
    const { run, calls } = await harness({
      dataset: 'full',
      seedMbid: mbid(302),
      seedName: 'Full Song',
    });
    await expect(run()).resolves.toBe('restored');

    expect(calls).toEqual([
      ['init', '--empty'],
      [
        'import',
        `${dumps.url}/fullexport/20240102-000003/mbdump.tar.bz2`,
        `${dumps.url}/fullexport/20240102-000003/mbdump-derived.tar.bz2`,
      ],
    ]);
    expect(dumps.requested).toEqual([
      '/data/fullexport/LATEST',
      '/data/fullexport/20240102-000003/mbdump.tar.bz2',
      '/data/fullexport/20240102-000003/mbdump-derived.tar.bz2',
    ]);
    expect(await statusOf()).toMatchObject({
      phase: 'restored',
      dataset: 'full',
    });

    // The worker's Lyrics import downloads the dump: serve it an empty one
    // from a fake server, never the real LRCLIB.
    const lrclib = await startFakeLrclibServer({
      'lrclib-db-dump-20240102T000000Z.sqlite3.gz': fakeLrclibDumpGz([]),
    });
    try {
      await createTestWorker(server(), {
        env: {
          CATALOG_DATASET: 'full',
          LRCLIB_BASE_URL: lrclib.baseUrl,
          LRCLIB_LISTING_URL: lrclib.listingUrl,
        },
      }).tick();
    } finally {
      await lrclib.close();
    }

    expect(await statusOf()).toMatchObject({
      phase: 'ready',
      dataset: 'full',
    });
    await expect(searchMbids('full song')).resolves.toContain(mbid(302));
    await expect(
      requestRecording(client(), { mbid: mbid(302) }),
    ).resolves.toMatchObject({
      ok: true,
      result: { lyrics: { plain: null, synced: null } },
    });
  });

  it('skips the download and the restore on a second start', async () => {
    await setBootstrapState(server().db, {
      phase: 'restored',
      dataset: 'tiny',
    });

    const { run, calls } = await harness();
    await expect(run()).resolves.toBe('skipped');

    expect(calls).toEqual([]);
    expect(dumps.requested).toEqual([]);
    expect(await statusOf()).toMatchObject({
      phase: 'restored',
      dataset: 'tiny',
    });
  });

  it('redoes an interrupted tiny restore from a clean state', async () => {
    await addRecording(server().db, { mbid: mbid(399), name: 'Leftover' });
    await setBootstrapState(server().db, {
      phase: 'restoring',
      dataset: 'tiny',
    });
    try {
      const { run, calls } = await harness();
      await expect(run()).resolves.toBe('restored');

      expect(calls[0]).toEqual(['init', '--empty']);
      // The interrupted restore's tables are gone with its rows (the
      // leftover recording included); only what the seed wrote is there.
      expect(await recordingCount()).toBe(TINY_RECORDING_COUNT);
      expect(await statusOf()).toMatchObject({
        phase: 'restored',
        dataset: 'tiny',
      });
    } finally {
      // Leaves the MusicBrainz schema behind for the files after this one,
      // however the test above ended. The redo dropped the schema with the
      // sync triggers in it, so they are reinstalled too: later files assume
      // the global setup's triggers, and file order is not guaranteed.
      await applyMusicBrainzSchema(inject('databaseUrl'));
      await applySyncTriggers(inject('databaseUrl'));
    }
  });

  it('refuses to switch the dataset of a catalog that is already restored', async () => {
    await setBootstrapState(server().db, { phase: 'ready', dataset: 'full' });

    const { run, calls } = await harness({ dataset: 'tiny' });
    await expect(run()).rejects.toThrow(/another dataset/);

    expect(calls).toEqual([]);
    expect(await statusOf()).toMatchObject({
      phase: 'ready',
      dataset: 'full',
    });
  });
});
