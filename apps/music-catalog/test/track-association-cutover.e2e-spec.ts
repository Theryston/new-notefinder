import { eq } from 'drizzle-orm';
import { acquireCatalogWriteLock } from '../src/database/catalog-write-lock.js';
import { trackAssociation } from '../src/database/schema/track-association.js';
import { ReimportStateRepository } from '../src/modules/reimport/reimport-state.repository.js';
import { waitForCatalogWriteLockWaiter } from './utils/database.js';
import { useIsolatedServer } from './utils/isolated-server.js';
import { mbid } from './utils/musicbrainz.js';
import {
  useCleanParallelCopy,
  useParallelDatabase,
} from './utils/reimport-harness.js';
import { requestTrackAssociation } from './utils/track-association-client.js';

describe('Track association cutover admission (e2e)', () => {
  const parallel = useParallelDatabase();
  const { server, client } = useIsolatedServer(parallel);
  useCleanParallelCopy(parallel);

  it('rejects an old-database delivery queued across server adoption', async () => {
    let unlock: () => void = () => undefined;
    let signalLocked: () => void = () => undefined;
    const lockAcquired = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    const releaseLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const holdingTransaction = server().db.transaction(async (transaction) => {
      await acquireCatalogWriteLock(transaction);
      signalLocked();
      await releaseLock;
    });
    await lockAcquired;

    try {
      const delayedDelivery = client().request(
        'associateTrack',
        { mbid: mbid(701), trackId: '00000000-0000-4000-8000-000000000701' },
        'queued-on-retired-database',
      );
      await waitForCatalogWriteLockWaiter(server().db);

      await new ReimportStateRepository(server().db).markSwitched(
        parallel().url,
      );
      await expect(client().request('status', {})).resolves.toMatchObject({
        ok: true,
      });

      unlock();
      await holdingTransaction;
      await expect(delayedDelivery).resolves.toMatchObject({
        ok: false,
        error: { code: 'REIMPORT_SWITCHING' },
      });

      await requestTrackAssociation(client(), {
        mbid: mbid(701),
        trackId: '00000000-0000-4000-8000-000000000701',
      });

      await expect(
        server()
          .db.select()
          .from(trackAssociation)
          .where(eq(trackAssociation.recordingMbid, mbid(701))),
      ).resolves.toEqual([]);
      await expect(
        parallel()
          .db.select()
          .from(trackAssociation)
          .where(eq(trackAssociation.recordingMbid, mbid(701))),
      ).resolves.toHaveLength(1);
    } finally {
      unlock();
      await holdingTransaction;
    }
  });
});
