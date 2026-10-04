import { setBootstrapState, setReplicationControl } from './utils/database.js';
import { useIsolatedServer } from './utils/isolated-server.js';
import { addRecording, mbid } from './utils/musicbrainz.js';
import { useReimportFlow } from './utils/reimport-flows.js';
import { stallReplication } from './utils/reimport-harness.js';
import {
  createTestWorker,
  useEmptyLyricsIndex,
  useEmptySearchIndex,
} from './utils/test-worker.js';

// The yearly schema change: the stall in `status` while search and
// `getRecording` answer (see test/utils/reimport-harness.ts for the shared
// setup and the faked boundaries).
describe('yearly schema change: the schema-change stall (e2e)', {
  timeout: 120_000,
}, () => {
  // One server per test (not per file): a switch test flips its process to
  // the parallel database, and the next test must read the serving copy
  // again. Booting per test is what keeps the adoption honest.
  const { server, client } = useIsolatedServer();

  useEmptySearchIndex();
  useEmptyLyricsIndex();

  const { statusResult, searchMbids, recordingLyrics } = useReimportFlow({
    server,
    client,
  });

  it('reports the schema-change stall while search and getRecording answer', async () => {
    const db = server().db;
    await addRecording(db, {
      mbid: mbid(911),
      name: 'Stall Witness Song',
      lengthMs: 180_000,
    });
    await setBootstrapState(db, { phase: 'restored', dataset: 'full' });
    await setReplicationControl(db, 199_999);
    const worker = createTestWorker(server(), {
      env: {
        CATALOG_DATASET: 'full',
        LRCLIB_BASE_URL: 'http://127.0.0.1:9/',
        LRCLIB_LISTING_URL: 'http://127.0.0.1:9/',
      },
    });
    await worker.tick();

    await stallReplication(db);

    await expect(statusResult()).resolves.toMatchObject({
      phase: 'ready',
      dataset: 'full',
      replicationSequence: 199_999,
      // The fixture write above reached the outbox through the triggers,
      // the way a replication packet's DML would: the stall and the lag
      // report together.
      pendingOutbox: 1,
      replicationStalled: { reason: 'schema-change' },
    });
    await expect(searchMbids('Stall Witness')).resolves.toEqual([mbid(911)]);
    await expect(recordingLyrics(mbid(911))).resolves.toEqual({
      plain: null,
      synced: null,
    });
  });
});
