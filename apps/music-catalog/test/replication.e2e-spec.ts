import { musicCatalogStatusResponseSchema } from '@notefinder/contracts';
import { MbslaveClient } from '../src/integrations/mbslave/mbslave-client.js';
import { ReplicationRepository } from '../src/modules/replication/replication.repository.js';
import { ReplicationService } from '../src/modules/replication/replication.service.js';
import { RecordingOutboxRepository } from '../src/modules/sync/recording-outbox.repository.js';
import { testLogger, useTestServer } from './utils/create-test-server.js';
import {
  setBootstrapState,
  setReplicationControl,
  setReplicationState,
} from './utils/database.js';
import { addRecording, mbid } from './utils/musicbrainz.js';
import { useTestClient } from './utils/use-test-client.js';

// Spawning the real `mbslave sync` here would need its Python/psql image, a
// MetaBrainz token and the network on every PR (like the first import, whose
// e2e fakes the binary behind the same boundary instead). The fake below
// moves mbslave's own cursor the way an applied packet would; everything
// else is the real service against the real database and the real WebSocket.
describe('replication: sequence and backlog in status (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  const status = async () => {
    const response = musicCatalogStatusResponseSchema.parse(
      await client().request('status', {}),
    );
    if (!response.ok) {
      throw new Error(`status failed: ${response.error.code}`);
    }
    return response.result;
  };

  // The real replication service wired like `restore.ts`, except mbslave
  // runs behind its integration boundary.
  const replicateOnce = (applied: number | null): ReplicationService => {
    const mbslave = new MbslaveClient(async (args) => {
      expect(args).toEqual(['sync']);
      if (applied !== null) {
        await setReplicationControl(server().db, applied);
      }
    });
    return new ReplicationService({
      sequences: new ReplicationRepository(server().db),
      backlog: new RecordingOutboxRepository(server().db),
      mbslave,
      dataset: 'full',
      musicbrainzToken: 'e2e-token',
      pollIntervalMs: 1,
      logger: testLogger,
    });
  };

  it('reports a null sequence with no backlog before the first packet', async () => {
    await setBootstrapState(server().db, { phase: 'ready', dataset: 'full' });

    await expect(status()).resolves.toEqual({
      phase: 'ready',
      dataset: 'full',
      replicationSequence: null,
      pendingOutbox: 0,
    });
  });

  it('records the applied sequence and the backlog a sync run sees', async () => {
    await setBootstrapState(server().db, { phase: 'ready', dataset: 'full' });
    await setReplicationControl(server().db, 188_657);
    // A change the worker's triggers enqueue, the way a packet's DML would.
    await addRecording(server().db, {
      mbid: mbid(401),
      name: 'Replication Backlog Song',
    });

    const result = await replicateOnce(188_660).replicateOnce();

    expect(result).toEqual({
      previousSequence: null,
      sequence: 188_660,
      pendingOutbox: 1,
    });
    await expect(status()).resolves.toEqual({
      phase: 'ready',
      dataset: 'full',
      replicationSequence: 188_660,
      pendingOutbox: 1,
    });
  });

  it('keeps reporting the recorded sequence when sync applies nothing new', async () => {
    await setBootstrapState(server().db, { phase: 'ready', dataset: 'full' });
    await setReplicationState(server().db, 188_660);
    await setReplicationControl(server().db, 188_660);

    const result = await replicateOnce(188_660).replicateOnce();

    expect(result).toMatchObject({ sequence: 188_660, pendingOutbox: 0 });
    await expect(status()).resolves.toMatchObject({
      replicationSequence: 188_660,
      pendingOutbox: 0,
    });
  });
});
