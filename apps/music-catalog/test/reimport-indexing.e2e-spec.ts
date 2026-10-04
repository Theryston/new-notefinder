import { useIsolatedServer } from './utils/isolated-server.js';
import { mbid } from './utils/musicbrainz.js';
import { useReimportFlow } from './utils/reimport-flows.js';
import {
  seedNewDump,
  useCleanParallelCopy,
  useFakeDumps,
  useParallelDatabase,
} from './utils/reimport-harness.js';
import {
  useEmptyLyricsIndex,
  useEmptySearchIndex,
} from './utils/test-worker.js';

// The yearly schema change: the reimport rebuilds the parallel copy while
// the serving copy answers (see test/utils/reimport-harness.ts for the
// shared setup and the faked boundaries).
describe('yearly schema change: reimporting beside the serving copy (e2e)', {
  timeout: 120_000,
}, () => {
  // One server per test (not per file): a switch test flips its process to
  // the parallel database, and the next test must read the serving copy
  // again. Booting per test is what keeps the adoption honest.
  const { server, client } = useIsolatedServer();

  useEmptySearchIndex();
  useEmptyLyricsIndex();

  const parallel = useParallelDatabase();
  useCleanParallelCopy(parallel);
  const dumps = useFakeDumps();
  const {
    statusResult,
    searchMbids,
    recordingLyrics,
    serveCatalog,
    restoreParallel,
  } = useReimportFlow({ server, client, parallel, dumps });

  it('reimports into the parallel copy while the serving copy answers', async () => {
    const worker = await serveCatalog();

    await restoreParallel(seedNewDump);

    // The container handed a restored copy over: the worker owns it now,
    // and `status` shows the reimport while the first import stays `ready`.
    await expect(statusResult()).resolves.toMatchObject({
      phase: 'ready',
      reimport: { phase: 'indexing' },
    });

    await worker.tick();

    // Indexed, not yet switched: the serving copy answers exactly what it
    // did before, and the new Recording is nowhere to be found yet.
    await expect(statusResult()).resolves.toMatchObject({
      phase: 'ready',
      reimport: { phase: 'switching', progressPct: 100 },
    });
    await expect(searchMbids('Same Take Song')).resolves.toEqual([mbid(901)]);
    await expect(searchMbids('Brand New Next')).resolves.toEqual([]);
    await expect(recordingLyrics(mbid(901))).resolves.toEqual({
      plain: 'same take la',
      synced: null,
    });
  });
});
