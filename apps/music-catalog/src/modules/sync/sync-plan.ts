import type { RecordingDocument } from '../../lib/recordings-index.js';

/** One pending outbox entry: a Recording that may need reindexing. */
export type OutboxEntry = {
  /** MusicBrainz's integer id of the Recording. */
  recordingId: number;
  /** The MBID it had when the change was written. */
  recordingMbid: string;
  /** When the change was (last) written, to order and bound batches. */
  enqueuedAt: Date;
};

/** A Recording that still exists, with the document the index should hold. */
export type CurrentRecording = {
  mbid: string;
  document: RecordingDocument;
};

export type SyncPlan = {
  /** Documents to (re)index, one per Recording that still exists. */
  upserts: RecordingDocument[];
  /** MBIDs to remove from the index: of deleted Recordings, or stale after a merge or an MBID change. */
  deletes: string[];
};

/**
 * What a batch of outbox entries means for the index. A Recording that still
 * exists is reindexed (its document is rebuilt from the database, so every
 * change since is in it); every enqueued MBID that is not its current one is
 * deleted (its row is gone, or the MBID moved to another Recording). Pure, so
 * reprocessing the same entries plans the same writes.
 */
export const planSync = (
  entries: readonly OutboxEntry[],
  current: ReadonlyMap<number, CurrentRecording>,
): SyncPlan => {
  const upserts = [...current.values()].map((recording) => recording.document);
  const deletes = new Set<string>();
  for (const entry of entries) {
    const recording = current.get(entry.recordingId);
    if (recording === undefined || recording.mbid !== entry.recordingMbid) {
      deletes.add(entry.recordingMbid);
    }
  }
  return { upserts, deletes: [...deletes] };
};
