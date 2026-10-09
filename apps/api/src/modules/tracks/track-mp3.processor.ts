import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { isFinalAttempt } from '../../queue/job-attempts.js';
import { storeMusicMp3JobSchema, TRACK_MP3_QUEUE } from './track-mp3.job.js';
import { TrackMp3Service } from './track-mp3.service.js';
import { messageOf } from './track-processing-failure.js';

/**
 * Consumes the music MP3 queue. A failure is retried by BullMQ; on its last
 * attempt it is logged, and the Processing is left as it is: nothing waits for
 * the music MP3.
 */
@Processor(TRACK_MP3_QUEUE, { concurrency: 2 })
export class TrackMp3Processor extends WorkerHost {
  private readonly logger = new Logger(TrackMp3Processor.name);

  constructor(private readonly mp3s: TrackMp3Service) {
    super();
  }

  process(job: Job<unknown>): Promise<void> {
    return this.run(job.data, isFinalAttempt(job));
  }

  /** `finalAttempt` tells whether BullMQ gives up on the job when this run throws. */
  async run(data: unknown, finalAttempt: boolean): Promise<void> {
    const parsed = storeMusicMp3JobSchema.safeParse(data);
    if (!parsed.success) {
      throw new UnrecoverableError('Invalid job payload');
    }
    const { processingId, trackId } = parsed.data;
    try {
      await this.mp3s.storeMusicMp3({ id: processingId, trackId });
    } catch (error) {
      if (!finalAttempt) {
        throw error;
      }
      this.logger.warn(
        `Processing ${processingId} has no music MP3: ${messageOf(error)}`,
      );
    }
  }
}
