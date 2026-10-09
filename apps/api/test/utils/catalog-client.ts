import { Test, type TestingModule } from '@nestjs/testing';
import { ENV } from '../../src/config/env.js';
import { MusicCatalogClient } from '../../src/integrations/music-catalog/music-catalog.client.js';
import {
  FAKE_CATALOG_API_KEY,
  type FakeCatalogHandler,
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from './fake-music-catalog.js';

/**
 * A `MusicCatalogClient` wired to a fake Music catalog that answers through
 * `handler`. `close` tears both down, the client's socket first.
 */
export const startCatalogClient = async (
  handler: FakeCatalogHandler,
): Promise<{ client: MusicCatalogClient; close: () => Promise<void> }> => {
  const catalog: FakeMusicCatalog = await startFakeMusicCatalog(handler);
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      MusicCatalogClient,
      {
        provide: ENV,
        useValue: {
          MUSIC_CATALOG_URL: catalog.url,
          MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
          MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 1_000,
        },
      },
    ],
  }).compile();
  await moduleRef.init();
  return {
    client: moduleRef.get(MusicCatalogClient),
    close: async () => {
      await moduleRef.close();
      await catalog.close();
    },
  };
};
