import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { Locale } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import type { TrackRequester } from './track-requester.service.js';
import { TrackRequesterService } from './track-requester.service.js';
import { retryPlanOf } from './track-retry.js';
import { TrackRetryRepository } from './track-retry.repository.js';

/**
 * Starts a new Processing of a Track whose latest Processing failed with a
 * retryable code (ADR 0005). The new Processing keeps the outputs of the failed
 * run and starts at the step it failed at; the User who retries becomes a
 * Contributor through a `RETRY` Contribution. The Track is locked first, so two
 * retries of the same failure can't both start a Processing.
 */
@Injectable()
export class TrackRetryService {
  constructor(
    private readonly processings: TrackProcessingRepository,
    private readonly retries: TrackRetryRepository,
    private readonly requesters: TrackRequesterService,
  ) {}

  /**
   * @throws {AppException} `CONFLICT` when the latest Processing cannot be
   * retried, `PROCESSING_LIMIT_REACHED` when the User is at the active limit.
   */
  @Transactional()
  async retry(
    requester: TrackRequester,
    trackId: string,
    locale: Locale,
  ): Promise<void> {
    await this.retries.lockTrackProcessings(trackId);
    const plan = retryPlanOf(await this.retries.findLatestForRetry(trackId));
    if (plan === undefined) {
      throw new AppException('CONFLICT', 'The Processing cannot be retried');
    }
    await this.requesters.assertCanRetry(requester);
    const processingId = await this.retries.insertRetryProcessing(
      trackId,
      plan,
    );
    const contributorId = await this.processings.findOrInsertContributor(
      trackId,
      requester.id,
    );
    await this.processings.insertContribution({
      contributorId,
      kind: 'RETRY',
      processingId,
    });
    await this.requesters.recordLocale(requester.id, locale);
  }
}
