import { inject } from 'vitest';
import { LyricsRepository } from '../src/modules/lyrics/lyrics.repository.js';
import { ReimportStateRepository } from '../src/modules/reimport/reimport-state.repository.js';
import { requestRecording } from './utils/get-recording-client.js';
import { useIsolatedServer } from './utils/isolated-server.js';
import { meilisearchRequest } from './utils/meilisearch-http.js';
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

// The yearly schema change: the flip to the parallel copy (see
// test/utils/reimport-harness.ts for the shared setup and the faked
// boundaries).
describe('yearly schema change: switching to the parallel copy (e2e)', {
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

  it('switches atomically, deletes the old copy and cuts the reads over', async () => {
    const worker = await serveCatalog();
    await restoreParallel(seedNewDump);
    await worker.tick();
    await worker.tick();

    // The flip is steady state: no reimport is reported anymore, and one
    // `status` lets the server adopt the new copy without restarting.
    await expect(statusResult()).resolves.toMatchObject({ phase: 'ready' });
    const result = await statusResult();
    expect(result).not.toHaveProperty('reimport');

    // Atomic from the client's point of view: one search answers the new
    // copy wholesale, and the new Recording resolves through `getRecording`
    // (which reads Postgres, so this proves the cutover, not just the swap).
    await expect(searchMbids('Brand New Next Song')).resolves.toEqual([
      mbid(903),
    ]);
    const recording = await requestRecording(client(), { mbid: mbid(903) });
    expect(recording).toMatchObject({ ok: true });
    if (recording.ok) {
      expect(recording.result.title).toBe('Brand New Next Song');
    }

    // Lyrics were reused from our own schema, with the match rerun and no
    // new download (the LRCLIB endpoints are closed ports in this suite):
    // the unchanged take kept its Lyrics, the resized one lost them, and
    // the lyrics scope finds the carried Lyrics on the new copy.
    await expect(recordingLyrics(mbid(901))).resolves.toEqual({
      plain: 'same take la',
      synced: null,
    });
    await expect(recordingLyrics(mbid(902))).resolves.toEqual({
      plain: null,
      synced: null,
    });
    await expect(searchMbids('same take la', 'lyrics')).resolves.toEqual([
      mbid(901),
    ]);

    // The old copy is deleted: the `*_next` indexes are gone, the stale
    // backlog is dropped, and the flip record names the new database on
    // both copies.
    const meilisearch = inject('meilisearch');
    await expect(
      meilisearchRequest(meilisearch, 'GET', '/indexes/recordings_next').then(
        ({ status }) => status,
      ),
    ).resolves.toBe(404);
    await expect(
      meilisearchRequest(meilisearch, 'GET', '/indexes/lyrics_next').then(
        ({ status }) => status,
      ),
    ).resolves.toBe(404);
    await expect(statusResult()).resolves.toMatchObject({ pendingOutbox: 0 });
    const serving = await new ReimportStateRepository(server().db).get();
    expect(serving).toMatchObject({
      phase: 'switched',
      detail: parallel().url,
    });
    const parallelState = await new ReimportStateRepository(
      parallel().db,
    ).get();
    expect(parallelState).toMatchObject({
      phase: 'switched',
      detail: parallel().url,
    });

    // The retired database is untouched by the reimport (cleanup is off in
    // this suite): the staged Lyrics are still there.
    await expect(
      new LyricsRepository(server().db).findByMbid(mbid(901)),
    ).resolves.toEqual({ plain: 'same take la', synced: null });
  });
});
