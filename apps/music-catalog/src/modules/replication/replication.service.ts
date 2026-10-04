import type { CatalogDataset, ReplicationStalled } from '@notefinder/contracts';
import type { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import { sleepUnlessAborted } from '../../lib/abortable-sleep.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type {
  RecordReplicationStall,
  ReplicationRepository,
  ReplicationStall,
} from './replication.repository.js';
import { assertReplicationToken } from './replication-token.js';
import { isSchemaMismatchError } from './schema-mismatch.js';

/**
 * How long the loop waits between two `mbslave sync` runs once it is caught
 * up. Packets are published hourly and one run applies every pending packet,
 * so ten minutes (mbslave's own `--keep-running` cadence) keeps the lag
 * small without polling the mirror constantly.
 */
export const REPLICATION_POLL_INTERVAL_MS = 10 * 60 * 1000;

// mbslave's message is a developer diagnostic; `status` only needs enough to
// recognize the failure.
const STALLED_DETAIL_MAX_LENGTH = 300;

export type ReplicationReport = {
  /** The last applied sequence, or null until the first packet lands. */
  replicationSequence: number | null;
  /** Entries still waiting to reach the search index. */
  pendingOutbox: number;
  /** Why sync cannot apply packets, set while it cannot. */
  replicationStalled?: ReplicationStalled;
};

/**
 * Where the loop records why sync cannot apply packets. `ReplicationRepository`
 * satisfies it structurally; declared separately so the specs written before
 * the stall keep constructing the service with the sequences repository
 * alone, and the loop without it behaves exactly as before.
 */
type ReplicationStallStore = {
  readStall: () => Promise<ReplicationStall | undefined>;
  recordStall: (stall: RecordReplicationStall) => Promise<void>;
  clearStall: () => Promise<void>;
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
  /**
   * Records why sync cannot apply packets; absent without the stall store
   * (see above).
   */
  stalls?: ReplicationStallStore;
  /** The mbslave release running here (`MBSLAVE_REF`), for the stall. */
  mbslaveRef?: string;
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
   * outbox backlog, read together so they describe the same moment, with the
   * stall while sync cannot apply packets.
   */
  async report(): Promise<ReplicationReport> {
    const [replicationSequence, pendingOutbox, stalled] = await Promise.all([
      this.deps.sequences.lastRecordedSequence(),
      this.deps.backlog.countPending(),
      this.deps.stalls?.readStall(),
    ]);
    if (stalled === undefined || stalled === null) {
      return { replicationSequence, pendingOutbox };
    }
    return {
      replicationSequence,
      pendingOutbox,
      replicationStalled: {
        reason: stalled.reason,
        ...(stalled.detail === null ? {} : { detail: stalled.detail }),
      },
    };
  }

  /** Why sync cannot apply packets, or undefined while it can. */
  async readStall(): Promise<ReplicationStall | undefined> {
    return this.deps.stalls?.readStall();
  }

  /** Forgets the stall: replication applies packets again. */
  async clearStall(): Promise<void> {
    await this.deps.stalls?.clearStall();
  }

  /**
   * Applies every pending packet once and records where the cursor landed.
   * A throw (a bad token, a schema mismatch, a lost database) propagates:
   * the container exits non-zero and the compose restart brings the loop
   * back, so a stall is never silent. A schema mismatch is recorded first,
   * so `status` names the yearly schema change while it crash-loops.
   */
  async replicateOnce(): Promise<ReplicateOnceResult> {
    const { sequences, backlog, mbslave, logger } = this.deps;
    const previousSequence = await sequences.lastRecordedSequence();
    try {
      await mbslave.sync();
    } catch (error) {
      await this.recordStall(error);
      throw error;
    }
    const sequence = await sequences.readAppliedSequence();
    if (sequence !== null && sequence !== previousSequence) {
      await sequences.recordSequence(sequence);
    }
    await this.deps.stalls?.clearStall();
    const pendingOutbox = await backlog.countPending();
    logger.info('Applied replication packets', {
      previousSequence,
      sequence,
      pendingOutbox,
    });
    return { previousSequence, sequence, pendingOutbox };
  }

  // Records a schema mismatch as the yearly schema change stall, with
  // mbslave's message truncated for `status`. Any other failure, or a loop
  // without the stall store, records nothing: the throw still propagates.
  private async recordStall(error: unknown): Promise<void> {
    const stalls = this.deps.stalls;
    if (stalls === undefined || !isSchemaMismatchError(error)) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    await stalls.recordStall({
      reason: 'schema-change',
      detail: message.slice(0, STALLED_DETAIL_MAX_LENGTH),
      mbslaveRef: this.deps.mbslaveRef,
    });
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
