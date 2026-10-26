import { eq } from 'drizzle-orm';
import { inject } from 'vitest';
import { withCatalogWriteLock } from '../src/database/catalog-write-lock.js';
import { indexingCheckpoint } from '../src/database/schema/indexing-checkpoint.js';
import { createMeilisearchIndex } from '../src/integrations/meilisearch/meilisearch-index.js';
import {
  RECORDINGS_INDEX,
  type RecordingDocument,
} from '../src/lib/recordings-index.js';
import { RecordingDocumentRepository } from '../src/modules/recording/recording-document.repository.js';
import { RecordingDocumentService } from '../src/modules/recording/recording-document.service.js';
import { useTestServer } from './utils/create-test-server.js';
import { meilisearchRequest } from './utils/meilisearch-http.js';
import { addArtist, addRecording, mbid } from './utils/musicbrainz.js';
import { requestSearch } from './utils/search-client.js';
import {
  createTestWorker,
  indexCatalog,
  useEmptySearchIndex,
} from './utils/test-worker.js';
import { requestTrackAssociation } from './utils/track-association-client.js';
import { useTestClient } from './utils/use-test-client.js';
import { openClient } from './utils/ws-client.js';

const TRACK_A = '00000000-0000-4000-8000-000000000101';
const TRACK_B = '00000000-0000-4000-8000-000000000102';

describe('Track association projection (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();

  it('acknowledges duplicates and replacements, then searches the latest complete document', async () => {
    const artist = await addArtist(server().db, { name: 'Band' });
    const recording = await addRecording(server().db, {
      mbid: mbid(501),
      name: 'Association Song',
      artists: [{ artist }],
    });
    await indexCatalog(server());

    await requestTrackAssociation(client(), {
      mbid: recording.mbid,
      trackId: TRACK_A,
    });
    await requestTrackAssociation(client(), {
      mbid: recording.mbid,
      trackId: TRACK_A,
    });
    await requestTrackAssociation(client(), {
      mbid: recording.mbid,
      trackId: TRACK_B,
    });
    await createTestWorker(server()).tick();

    const response = await requestSearch(client(), {
      query: 'Association Song',
    });
    expect(response).toMatchObject({
      ok: true,
      result: { results: [{ mbid: recording.mbid, trackId: TRACK_B }] },
    });
    const meilisearch = inject('meilisearch');
    const document = await meilisearchRequest(
      meilisearch,
      'GET',
      `/indexes/recordings/documents/${recording.mbid}`,
    );
    expect(document.json).toMatchObject({
      mbid: recording.mbid,
      title: 'Association Song',
      trackId: TRACK_B,
      artistCredit: 'Band',
    });
    const idSearch = await requestSearch(client(), { query: TRACK_B });
    expect(idSearch).toMatchObject({ ok: true, result: { results: [] } });
  });

  it('keeps an association for a missing Recording until indexing creates a full document, including after worker restart', async () => {
    await indexCatalog(server());
    const recordingMbid = mbid(502);
    await requestTrackAssociation(client(), {
      mbid: recordingMbid,
      trackId: TRACK_A,
    });

    const restartedWorker = createTestWorker(server());
    await restartedWorker.tick();
    const before = await requestSearch(client(), { query: 'Later Song' });
    expect(before).toMatchObject({ ok: true, result: { results: [] } });
    const meilisearch = inject('meilisearch');
    const missingDocument = await meilisearchRequest(
      meilisearch,
      'GET',
      `/indexes/recordings/documents/${recordingMbid}`,
    );
    expect(missingDocument.status).toBe(404);

    const artist = await addArtist(server().db, { name: 'Later Band' });
    await addRecording(server().db, {
      mbid: recordingMbid,
      name: 'Later Song',
      artists: [{ artist }],
    });
    await restartedWorker.tick();

    const after = await requestSearch(client(), { query: 'Later Song' });
    expect(after).toMatchObject({
      ok: true,
      result: { results: [{ mbid: recordingMbid, trackId: TRACK_A }] },
    });
  });

  it('orders a stale metadata replacement before a concurrent association and retries the complete document', async () => {
    const artist = await addArtist(server().db, { name: 'Race Band' });
    const recording = await addRecording(server().db, {
      mbid: mbid(503),
      name: 'Race Song',
      artists: [{ artist }],
    });
    await indexCatalog(server());
    const documents = new RecordingDocumentService(
      new RecordingDocumentRepository(server().db),
    );
    const meilisearch = inject('meilisearch');
    const index = createMeilisearchIndex<RecordingDocument>({
      url: meilisearch.url,
      apiKey: meilisearch.writeKey,
      ...RECORDINGS_INDEX,
    });
    let releaseWrite: () => void = () => undefined;
    let snapshotReady: () => void = () => undefined;
    const release = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const snapshotted = new Promise<void>((resolve) => {
      snapshotReady = resolve;
    });
    const staleReplacement = withCatalogWriteLock(server().db, async () => {
      const [snapshot] = await documents.findDocumentsByIds([recording.id]);
      if (snapshot === undefined) {
        throw new Error('The Recording snapshot was missing.');
      }
      snapshotReady();
      await release;
      await index.upsert([snapshot.document]);
    });
    await snapshotted;
    const delivery = requestTrackAssociation(client(), {
      mbid: recording.mbid,
      trackId: TRACK_A,
    });
    releaseWrite();
    await Promise.all([staleReplacement, delivery]);
    await createTestWorker(server()).tick();

    await expect(
      requestSearch(client(), { query: 'Race Song' }),
    ).resolves.toMatchObject({
      ok: true,
      result: { results: [{ mbid: recording.mbid, trackId: TRACK_A }] },
    });
    const indexed = await meilisearchRequest(
      meilisearch,
      'GET',
      `/indexes/recordings/documents/${recording.mbid}`,
    );
    expect(indexed.json).toMatchObject({ trackId: TRACK_A });
  });

  it('keeps the Track ID through a full index reconstruction', async () => {
    const artist = await addArtist(server().db, { name: 'Rebuild Band' });
    const recording = await addRecording(server().db, {
      mbid: mbid(504),
      name: 'Rebuild Song',
      artists: [{ artist }],
    });
    await indexCatalog(server());
    await requestTrackAssociation(client(), {
      mbid: recording.mbid,
      trackId: TRACK_B,
    });
    await createTestWorker(server()).tick();

    const meilisearch = inject('meilisearch');
    await meilisearchRequest(meilisearch, 'DELETE', '/indexes/recordings');
    await server()
      .db.delete(indexingCheckpoint)
      .where(eq(indexingCheckpoint.indexUid, RECORDINGS_INDEX.uid));
    await indexCatalog(server());

    await expect(
      requestSearch(client(), { query: 'Rebuild Song' }),
    ).resolves.toMatchObject({
      ok: true,
      result: { results: [{ mbid: recording.mbid, trackId: TRACK_B }] },
    });
  });

  it('rejects malformed or unauthenticated association delivery', async () => {
    await indexCatalog(server());
    const invalid = await client().request('associateTrack', {
      mbid: 'not-an-mbid',
      trackId: TRACK_A,
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    const unauthenticated = await openClient(server().url, {
      key: 'wrong-key',
    });
    expect(unauthenticated).toMatchObject({ opened: false, status: 401 });
  });
});
