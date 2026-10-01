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
import { applyMusicBrainzSchema } from './setup/musicbrainz-schema.js';
import { testLogger, useTestServer } from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import {
  type FakeDumpServer,
  startFakeDumpServer,
} from './utils/fake-dump-server.js';
import { addRecording, mbid } from './utils/musicbrainz.js';
import { requestSearch } from './utils/search-client.js';
import { createTestWorker, useEmptySearchIndex } from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';

// Recreating the 375-table MusicBrainz schema (the redo test) and
// indexing to ready take longer than vitest's 5s default on CI runners.
describe('first import: the mbslave container restores the dump (e2e)', {
  timeout: 120_000,
}, () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();

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
  // would create, and `import` downloads the archives over real HTTP from
  // the fake dump server and seeds what the dump would load. Spawning the
  // real binary here would need its Python/psql image, minutes per run and
  // the network on every PR; the spike verified the real commands against a
  // fake mirror instead (docs/research/music-catalog-spike.md, section 2).
  const harness = async (
    options: {
      dataset?: CatalogDataset;
      seedMbid?: string;
      seedName?: string;
    } = {},
  ) => {
    const calls: string[][] = [];
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
        baseUrl: dumps.url,
        dataset: options.dataset ?? 'sample',
        logger: testLogger,
      }),
    );
    return { run: () => restore.run(), calls };
  };

  const statusPhase = async (): Promise<string> => {
    const response = musicCatalogStatusResponseSchema.parse(
      await client().request('status', {}),
    );
    if (!response.ok) {
      throw new Error('status failed');
    }
    return response.result.phase;
  };

  const searchMbids = async (query: string): Promise<string[]> => {
    const response = await requestSearch(client(), { query });
    if (!response.ok) {
      throw new Error(`search failed: ${response.error.code}`);
    }
    return response.result.results.map((result) => result.mbid);
  };

  const recordingGids = async (): Promise<string[]> => {
    const rows = await server().db.execute<{ gid: string }>(
      sql`select gid from musicbrainz.recording`,
    );
    return rows.rows.map((row) => row.gid).sort();
  };

  it('restores the sample dump to ready on the first run', async () => {
    expect(await statusPhase()).toBe('restoring');
    await expect(
      requestSearch(client(), { query: 'first song' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'CATALOG_NOT_READY' },
    });

    const { run, calls } = await harness();
    await expect(run()).resolves.toBe('restored');

    expect(calls).toEqual([
      ['init', '--empty'],
      ['import', `${dumps.url}/sample/20240101-000001/mbdump-sample.tar.xz`],
    ]);
    expect(dumps.requested).toEqual([
      '/data/sample/LATEST',
      '/data/sample/20240101-000001/mbdump-sample.tar.xz',
    ]);
    expect(await statusPhase()).toBe('restored');

    await createTestWorker(server()).tick();

    expect(await statusPhase()).toBe('ready');
    await expect(searchMbids('first song')).resolves.toContain(mbid(301));
  });

  it('skips the download and the restore on a second start', async () => {
    await setBootstrapState(server().db, {
      phase: 'restored',
      dataset: 'sample',
    });

    const { run, calls } = await harness();
    await expect(run()).resolves.toBe('skipped');

    expect(calls).toEqual([]);
    expect(dumps.requested).toEqual([]);
    expect(await statusPhase()).toBe('restored');
  });

  it('redoes an interrupted restore from a clean state', async () => {
    await addRecording(server().db, { mbid: mbid(399), name: 'Leftover' });
    await setBootstrapState(server().db, {
      phase: 'restoring',
      dataset: 'sample',
    });
    try {
      const { run, calls } = await harness({
        seedMbid: mbid(302),
        seedName: 'Second Song',
      });
      await expect(run()).resolves.toBe('restored');

      expect(calls[0]).toEqual(['init', '--empty']);
      // The interrupted import's tables are gone with its rows; only what
      // the redo loaded is there.
      await expect(recordingGids()).resolves.toEqual([mbid(302)]);
      expect(await statusPhase()).toBe('restored');
    } finally {
      // Leaves the MusicBrainz schema behind for the files after this one,
      // however the test above ended.
      await applyMusicBrainzSchema(inject('databaseUrl'));
    }
  });

  it('refuses to switch the dataset of a catalog that is already restored', async () => {
    await setBootstrapState(server().db, { phase: 'ready', dataset: 'full' });

    const { run, calls } = await harness({ dataset: 'sample' });
    await expect(run()).rejects.toThrow(/another dataset/);

    expect(calls).toEqual([]);
    expect(await statusPhase()).toBe('ready');
  });
});
