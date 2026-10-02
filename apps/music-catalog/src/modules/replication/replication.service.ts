import type { CatalogDataset } from '@notefinder/contracts';
import type { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import { sleepUnlessAborted } from '../../lib/abortable-sleep.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { ReplicationRepository } from './replication.repository.js';
import { assertReplicationToken } from './replication-token.js';

/**
 * How long the loop waits between two `mbslave sync` runs once it is caught
 * up. Packets are published hourly and one run applies every pending packet,
 * so ten minutes (mbslave's own `--keep-running` cadence) keeps the lag
 * small without polling the mirror constantly.
 */
export const REPLICATION_POLL_INTERVAL_MS = 10 * 60 * 1000;

export type ReplicationReport = {
  /** The last applied sequence, or null until the first packet lands. */
  replicationSequence: number | null;
  /** Entries still waiting to reach the search index. */
  pendingOutbox: number;
};

/**
 * Where the loop reads the replication lag: the outbox count. Declared
 * structurally so this module never imports the sync module's repository
 * (modules talk through services); `RecordingOutboxRepository` satisfies it.
 */
type ReplicationBacklog = {
  countPending: () => Promise<number>;
};

export type ReplicationServiceDeps = {
  sequences: ReplicationRepository;
  backlog: ReplicationBacklog;
  /** Opened against the mbslave binary, which reads its own `MBSLAVE_*`. */
  mbslave: MbslaveClient;
  /** Which MusicBrainz data this deployment runs (`CATALOG_DATASET`). */
  dataset: CatalogDataset;
  /** `MBSLAVE_MUSICBRAINZ_TOKEN`, presence-checked in `full` mode. */
  musicbrainzToken?: string;
  /** `MBSLAVE_MUSICBRAINZ_TOKEN_FILE`, the Docker-secrets alternative. */
  musicbrainzTokenFile?: string;
  /** Between two sync runs; defaults to `REPLICATION_POLL_INTERVAL_MS`. */
  pollIntervalMs?: number;
  logger: Logger;
};

export type ReplicationRunOutcome = 'off' | 'stopped';

export type ReplicateOnceResult = {
  /** What our table held before this run (null until the first packet). */
  previousSequence: number | null;
  /** What mbslave's cursor holds now (null while it holds nothing). */
  sequence: number | null;
  /** Entries still waiting to reach the search index. */
  pendingOutbox: number;
};

export class ReplicationService {
  constructor(private readonly deps: ReplicationServiceDeps) {}

  /**
   * What `status` reports about replication: the recorded sequence and the
   * outbox backlog, read together so they describe the same moment.
   */
  async report(): Promise<ReplicationReport> {
    const [replicationSequence, pendingOutbox] = await Promise.all([
      this.deps.sequences.lastRecordedSequence(),
      this.deps.backlog.countPending(),
    ]);
    return { replicationSequence, pendingOutbox };
  }

  /**
   * Applies every pending packet once and records where the cursor landed.
   * A throw (a bad token, a schema mismatch, a lost database) propagates:
   * the container exits non-zero and the compose restart brings the loop
   * back, so a stall is never silent.
   */
  async replicateOnce(): Promise<ReplicateOnceResult> {
    const { sequences, backlog, mbslave, logger } = this.deps;
    const previousSequence = await sequences.lastRecordedSequence();
    await mbslave.sync();
    const sequence = await sequences.readAppliedSequence();
    if (sequence !== null && sequence !== previousSequence) {
      await sequences.recordSequence(sequence);
    }
    const pendingOutbox = await backlog.countPending();
    logger.info('Applied replication packets', {
      previousSequence,
      sequence,
      pendingOutbox,
    });
    return { previousSequence, sequence, pendingOutbox };
  }

  /**
   * Replicates continuously in `full` mode: waits for the catalog to be
   * `ready` (the worker installs the change triggers after the restore and
   * before indexing, so only then does every packet reach the outbox), then
   * applies the pending packets, records the sequence and sleeps, until
   * `signal` aborts. In `tiny` mode it logs once and returns: the seed
   * writes no replication data. Aborting the signal stops it after the sync
   * in progress.
   */
  async run(
    signal: AbortSignal,
    bootstrap: BootstrapService,
  ): Promise<ReplicationRunOutcome> {
    const { dataset, logger } = this.deps;
    if (dataset !== 'full') {
      logger.info('Replication stays off: tiny seeds no replication packets', {
        dataset,
      });
      return 'off';
    }
    assertReplicationToken({
      dataset,
      token: this.deps.musicbrainzToken,
      tokenFile: this.deps.musicbrainzTokenFile,
    });
    const intervalMs = this.deps.pollIntervalMs ?? REPLICATION_POLL_INTERVAL_MS;
    await this.waitUntilReady(signal, bootstrap, intervalMs);
    if (signal.aborted) {
      return 'stopped';
    }
    logger.info('Starting continuous replication', { intervalMs });
    while (!signal.aborted) {
      await this.replicateOnce();
      await sleepUnlessAborted(intervalMs, signal);
    }
    logger.info('Replication stopped: the container is stopping');
    return 'stopped';
  }

  private async waitUntilReady(
    signal: AbortSignal,
    bootstrap: BootstrapService,
    intervalMs: number,
  ): Promise<void> {
    let announced = false;
    for (;;) {
      const { phase } = await bootstrap.getStatus();
      if (phase === 'ready' || signal.aborted) {
        return;
      }
      if (!announced) {
        this.deps.logger.info(
          'Waiting for the catalog to be ready before replicating',
          { phase },
        );
        announced = true;
      }
      await sleepUnlessAborted(intervalMs, signal);
    }
  }
}
