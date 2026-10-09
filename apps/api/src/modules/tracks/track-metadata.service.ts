import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import type { Queue } from 'bullmq';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import {
  IMPORT_METADATA_JOB,
  type ImportMetadataJob,
  metadataJobId,
  TRACK_METADATA_QUEUE,
} from './track-metadata.job.js';
import type { ImportedLinks } from './track-metadata-import.service.js';
import { TrackMetadataImportService } from './track-metadata-import.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { messageOf } from './track-processing-failure.js';

/**
 * Queues and runs the metadata import of a Track (ADR 0005). The import runs
 * beside the Processing and never fails it: nothing here writes a Processing.
 */
@Injectable()
export class TrackMetadataService {
  private readonly logger = new Logger(TrackMetadataService.name);

  constructor(
    @InjectQueue(TRACK_METADATA_QUEUE)
    private readonly queue: Queue<ImportMetadataJob>,
    private readonly processings: TrackProcessingRepository,
    private readonly importer: TrackMetadataImportService,
    private readonly revalidation: WebRevalidationService,
  ) {}

  /**
   * Queues the import for the Track's newest Processing. A request that creates
   * a Track calls it, and so does a retry once it has created the retry's
   * Processing. Keyed by Processing, so every retry runs the import again while
   * a repeated enqueue of the same Processing changes nothing.
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

  /**
   * One import attempt. A failure is thrown, so BullMQ retries it with backoff;
   * on the last attempt it is only logged, and the Track keeps what was imported.
   */
  async run(job: ImportMetadataJob, finalAttempt: boolean): Promise<void> {
    try {
      const links = await this.importer.importMetadata(job.trackId);
      await this.refreshPagesIfCompleted(job.trackId, links);
    } catch (error) {
      if (!finalAttempt) {
        throw error;
      }
      this.logger.error(
        `Metadata of Track ${job.trackId} was not imported: ${messageOf(error)}`,
      );
    }
  }

  /**
   * Artist and Album pages list a Track only once it is completed, so a
   * completed Track's pages are refreshed here. A Track still processing has
   * nothing to show on them yet.
   */
  private async refreshPagesIfCompleted(
    trackId: string,
    links: ImportedLinks,
  ): Promise<void> {
    if (links.artistIds.length + links.albumIds.length === 0) {
      return;
    }
    // A Track's latest Processing is completed exactly when it has one: a
    // completed Processing is never followed by another.
    const latest = await this.processings.findLatestProcessing(trackId);
    if (latest?.status !== 'COMPLETED') {
      return;
    }
    await this.revalidation.revalidate([
      ...links.artistIds.flatMap((id) => [
        cacheTags.artist(id),
        cacheTags.artistTracks(id),
      ]),
      ...links.albumIds.flatMap((id) => [
        cacheTags.album(id),
        cacheTags.albumTracks(id),
      ]),
    ]);
  }
}
