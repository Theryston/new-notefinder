import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  IMPORT_METADATA_JOB,
  type ImportMetadataJob,
  metadataJobId,
  TRACK_METADATA_QUEUE,
} from '../../queue/track-metadata.job.js';
import { TrackProcessingRepository } from './track-processing.repository.js';

/**
 * Queues the metadata import of a Track (ADR 0005). The import itself runs in
 * the track-metadata module; this service only queues it, so the tracks module
 * never depends on the module that imports Artists and Albums.
 */
@Injectable()
export class TrackMetadataQueueService {
  constructor(
    @InjectQueue(TRACK_METADATA_QUEUE)
    private readonly queue: Queue<ImportMetadataJob>,
    private readonly processings: TrackProcessingRepository,
  ) {}

  /**
   * Queues the import for the Track's newest Processing. Only the request that
   * creates a Track calls it today: no retry path enqueues yet, and the retry
   * endpoint (#142) wires that in once it has created the retry's Processing.
   * Keyed by Processing, so a repeated enqueue of one Processing changes nothing,
   * and each Processing gets an import of its own.
   */
  async enqueueImport(trackId: string): Promise<void> {
    const latest = await this.processings.findLatestProcessing(trackId);
    if (latest === undefined) {
      return;
    }
    await this.queue.add(
      IMPORT_METADATA_JOB,
      { trackId },
      { jobId: metadataJobId(latest.id) },
    );
  }
}
