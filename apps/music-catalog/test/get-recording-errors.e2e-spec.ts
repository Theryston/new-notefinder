import { useTestServer } from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import { requestRecording } from './utils/get-recording-client.js';
import {
  addRecording,
  addRecordingRedirect,
  deleteRecording,
  mbid,
} from './utils/musicbrainz.js';
import { useReadyCatalog } from './utils/use-ready-catalog.js';
import { useTestClient } from './utils/use-test-client.js';

describe('getRecording: failures (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  // A Recording MusicBrainz merged `mbid(101)` into.
  const mergedRecording = async () => {
    const kept = await addRecording(server().db, {
      mbid: mbid(100),
      name: 'Kept',
    });
    await addRecordingRedirect(server().db, mbid(101), kept);
    return kept;
  };

  describe('once the catalog is ready', () => {
    useReadyCatalog(server);

    it('answers RECORDING_NOT_FOUND for an MBID the catalog does not know', async () => {
      await addRecording(server().db, { mbid: mbid(100), name: 'Known' });

      const response = await requestRecording(client(), { mbid: mbid(999) });

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'RECORDING_NOT_FOUND' },
      });
      expect(response).not.toHaveProperty('error.newMbid');
    });

    it('answers RECORDING_MOVED with the new MBID for an MBID merged into another Recording', async () => {
      await mergedRecording();

      const response = await requestRecording(client(), { mbid: mbid(101) });

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'RECORDING_MOVED', newMbid: mbid(100) },
      });
    });

    it('still answers the new MBID of a merge with the Recording itself', async () => {
      await mergedRecording();

      const response = await requestRecording(client(), { mbid: mbid(100) });

      expect(response).toMatchObject({ ok: true, result: { title: 'Kept' } });
    });

    it('answers RECORDING_NOT_FOUND when the Recording an MBID was merged into is gone', async () => {
      const deleted = await addRecording(server().db, {
        mbid: mbid(100),
        name: 'Deleted later',
      });
      await addRecordingRedirect(server().db, mbid(101), deleted);
      await deleteRecording(server().db, deleted);

      const response = await requestRecording(client(), { mbid: mbid(101) });

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'RECORDING_NOT_FOUND' },
      });
    });

    it('finds a Recording whatever the case of the MBID', async () => {
      await addRecording(server().db, { mbid: mbid(255), name: 'Known' });

      const response = await requestRecording(client(), {
        mbid: mbid(255).toUpperCase(),
      });

      expect(response).toMatchObject({ ok: true, result: { mbid: mbid(255) } });
    });

    it.each([
      ['no payload', undefined],
      ['an empty payload', {}],
      ['an MBID that is not text', { mbid: 42 }],
      ['text that is not an MBID', { mbid: 'not-an-mbid' }],
      ['an MBID with a character too many', { mbid: `${mbid(1)}0` }],
      ['an empty MBID', { mbid: '' }],
    ])(
      'answers VALIDATION_FAILED for %s, keeping the connection open',
      async (_label, payload) => {
        const response = await requestRecording(client(), payload);

        expect(response).toMatchObject({
          ok: false,
          error: { code: 'VALIDATION_FAILED' },
        });
        expect(client().isOpen).toBe(true);
      },
    );
  });

  describe('before the first import finishes', () => {
    it.each(['restoring', 'restored', 'indexing'] as const)(
      'answers CATALOG_NOT_READY in the %s phase, even for a Recording that exists',
      async (phase) => {
        await addRecording(server().db, { mbid: mbid(100), name: 'Known' });
        await setBootstrapState(server().db, { phase, dataset: 'sample' });

        const response = await requestRecording(client(), { mbid: mbid(100) });

        expect(response).toMatchObject({
          ok: false,
          error: { code: 'CATALOG_NOT_READY' },
        });
      },
    );

    it('answers CATALOG_NOT_READY before the import has recorded anything', async () => {
      const response = await requestRecording(client(), { mbid: mbid(100) });

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'CATALOG_NOT_READY' },
      });
    });

    it('starts answering on the same connection once the import is ready', async () => {
      await addRecording(server().db, { mbid: mbid(100), name: 'Known' });
      await setBootstrapState(server().db, {
        phase: 'indexing',
        dataset: 'sample',
      });
      const before = await requestRecording(client(), { mbid: mbid(100) });

      await setBootstrapState(server().db, {
        phase: 'ready',
        dataset: 'sample',
      });
      const after = await requestRecording(client(), { mbid: mbid(100) });

      expect(before).toMatchObject({
        ok: false,
        error: { code: 'CATALOG_NOT_READY' },
      });
      expect(after).toMatchObject({ ok: true, result: { title: 'Known' } });
    });
  });
});
