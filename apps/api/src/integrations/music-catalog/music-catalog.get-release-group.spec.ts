import { startCatalogClient } from '../../../test/utils/catalog-client.js';
import {
  artistFixture,
  releaseGroupFixture,
} from '../../../test/utils/catalog-fixtures.js';
import { testMbid } from '../../../test/utils/factories.js';

// `getReleaseGroup` and `getArtist` over the real WebSocket protocol: the
// answers that are results (found, not-found, moved) and the failures.
describe('MusicCatalogClient release groups and artists', () => {
  let close: (() => Promise<void>) | undefined;

  const startClient = async (
    handler: Parameters<typeof startCatalogClient>[0],
  ) => {
    const started = await startCatalogClient(handler);
    close = started.close;
    return started.client;
  };

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  describe('getReleaseGroup', () => {
    it('answers the release group the catalog found', async () => {
      const releaseGroup = releaseGroupFixture({ mbid: testMbid(40) });
      const client = await startClient((payload) => {
        expect(payload).toEqual({ mbid: testMbid(40) });
        return { result: releaseGroup };
      });

      await expect(client.getReleaseGroup(testMbid(40))).resolves.toEqual({
        status: 'found',
        releaseGroup,
      });
    });

    it('answers an unknown release group as not-found', async () => {
      const client = await startClient(() => ({
        error: {
          code: 'RELEASE_GROUP_NOT_FOUND',
          message: 'No such release group',
        },
      }));

      await expect(client.getReleaseGroup(testMbid(40))).resolves.toEqual({
        status: 'not-found',
      });
    });

    it('answers a merged release group as moved, with the MBID it moved to', async () => {
      const client = await startClient(() => ({
        error: {
          code: 'RELEASE_GROUP_MOVED',
          message: 'Merged',
          newMbid: testMbid(42),
        },
      }));

      await expect(client.getReleaseGroup(testMbid(40))).resolves.toEqual({
        status: 'moved',
        newMbid: testMbid(42),
      });
    });

    it('throws an INTERNAL_ERROR for a failure the lookup does not expect', async () => {
      const client = await startClient(() => ({
        error: { code: 'INTERNAL', message: 'Database is down' },
      }));

      await expect(client.getReleaseGroup(testMbid(40))).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('getArtist', () => {
    it('answers the artist the catalog found, with its genres', async () => {
      const artist = artistFixture({ mbid: testMbid(41) });
      const client = await startClient((payload) => {
        expect(payload).toEqual({ mbid: testMbid(41) });
        return { result: artist };
      });

      await expect(client.getArtist(testMbid(41))).resolves.toEqual({
        status: 'found',
        artist,
      });
    });

    it('answers an unknown artist as not-found', async () => {
      const client = await startClient(() => ({
        error: { code: 'ARTIST_NOT_FOUND', message: 'No such artist' },
      }));

      await expect(client.getArtist(testMbid(41))).resolves.toEqual({
        status: 'not-found',
      });
    });

    it('answers a merged artist as moved, with the MBID it moved to', async () => {
      const client = await startClient(() => ({
        error: {
          code: 'ARTIST_MOVED',
          message: 'Merged',
          newMbid: testMbid(43),
        },
      }));

      await expect(client.getArtist(testMbid(41))).resolves.toEqual({
        status: 'moved',
        newMbid: testMbid(43),
      });
    });

    it('throws a SERVICE_UNAVAILABLE while the catalog is not ready', async () => {
      const client = await startClient(() => ({
        error: { code: 'CATALOG_NOT_READY', message: 'Still indexing' },
      }));

      await expect(client.getArtist(testMbid(41))).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });
});
