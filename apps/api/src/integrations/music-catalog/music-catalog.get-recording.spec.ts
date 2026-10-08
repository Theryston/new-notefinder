import { Test, type TestingModule } from '@nestjs/testing';
import { testMbid } from '../../../test/utils/factories.js';
import {
  FAKE_CATALOG_API_KEY,
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from '../../../test/utils/fake-music-catalog.js';
import { recordingFixture } from '../../../test/utils/recording-fixtures.js';
import { ENV } from '../../config/env.js';
import { MusicCatalogClient } from './music-catalog.client.js';

// `getRecording` over the real WebSocket protocol: the answers that are
// results (found, not-found, moved) and the ones that are failures.
describe('MusicCatalogClient.getRecording', () => {
  let catalog: FakeMusicCatalog | undefined;
  let moduleRef: TestingModule | undefined;

  const startClient = async (
    handler: Parameters<typeof startFakeMusicCatalog>[0],
    timeoutMs = 1_000,
  ): Promise<MusicCatalogClient> => {
    catalog = await startFakeMusicCatalog(handler);
    moduleRef = await Test.createTestingModule({
      providers: [
        MusicCatalogClient,
        {
          provide: ENV,
          useValue: {
            MUSIC_CATALOG_URL: catalog.url,
            MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
            MUSIC_CATALOG_REQUEST_TIMEOUT_MS: timeoutMs,
          },
        },
      ],
    }).compile();
    await moduleRef.init();
    return moduleRef.get(MusicCatalogClient);
  };

  afterEach(async () => {
    // The app closes first so its socket is gone before the fake stops.
    await moduleRef?.close();
    moduleRef = undefined;
    await catalog?.close();
    catalog = undefined;
  });

  it('answers the Recording the catalog found', async () => {
    const recording = recordingFixture({ mbid: testMbid(1) });
    const client = await startClient((payload) => {
      expect(payload).toEqual({ mbid: testMbid(1) });
      return { result: recording };
    });

    await expect(client.getRecording(testMbid(1))).resolves.toEqual({
      status: 'found',
      recording,
    });
  });

  it('answers a Recording the catalog does not know as not-found', async () => {
    const client = await startClient(() => ({
      error: { code: 'RECORDING_NOT_FOUND', message: 'No such Recording' },
    }));

    await expect(client.getRecording(testMbid(1))).resolves.toEqual({
      status: 'not-found',
    });
  });

  it('answers a merged Recording as moved, with the MBID it moved to', async () => {
    const client = await startClient(() => ({
      error: {
        code: 'RECORDING_MOVED',
        message: 'Merged',
        newMbid: testMbid(2),
      },
    }));

    await expect(client.getRecording(testMbid(1))).resolves.toEqual({
      status: 'moved',
      newMbid: testMbid(2),
    });
  });

  it('treats a move without its new MBID as an internal error', async () => {
    const client = await startClient(() => ({
      error: { code: 'RECORDING_MOVED', message: 'Merged, no target' },
    }));

    await expect(client.getRecording(testMbid(1))).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });

  it('maps a catalog that is still starting to SERVICE_UNAVAILABLE', async () => {
    const client = await startClient(() => ({
      error: { code: 'CATALOG_NOT_READY', message: 'Starting' },
    }));

    await expect(client.getRecording(testMbid(1))).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('keeps other catalog errors as INTERNAL_ERROR', async () => {
    const client = await startClient(() => ({
      error: { code: 'INTERNAL', message: 'Database down' },
    }));

    await expect(client.getRecording(testMbid(1))).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });

  it('drops a reply that is not a Recording and times out', async () => {
    const client = await startClient(() => ({ result: { results: [] } }), 200);

    await expect(client.getRecording(testMbid(1))).rejects.toMatchObject({
      code: 'GATEWAY_TIMEOUT',
    });
  });
});
