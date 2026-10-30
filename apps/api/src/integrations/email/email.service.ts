import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ENV, type Env } from '../../config/env.js';
import {
  type AccountExistsEmailInput,
  renderAccountExistsEmail,
} from './account-exists-email.js';
import {
  EMAIL_JOB,
  EMAIL_QUEUE,
  type EmailMessage,
  emailMessageSchema,
} from './email.job.js';
import { type OtpEmailInput, renderOtpEmail } from './otp-email.js';
import {
  renderTrackCompletedEmail,
  renderTrackFailedEmail,
  type TrackEmailInput,
} from './track-processing-email.js';

const DAY_SECONDS = 24 * 60 * 60;

/** Options of one enqueue. */
export type EmailSendOptions = {
  /**
   * A job ID makes a repeated enqueue a no-op while the first job is pending, so
   * a replayed step sends an email once.
   */
  jobId?: string;
  /** Retain deduplication after delivery when a transaction might replay. */
  retainForSeconds?: number;
};

/**
 * Sends transactional email in the background (with retries), so a slow or
 * briefly unavailable provider never delays the request that triggered it.
 */
@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailMessage>,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** @throws {ZodError} when the message is invalid. */
  async send(
    message: EmailMessage,
    options: EmailSendOptions = {},
  ): Promise<void> {
    await this.queue.add(EMAIL_JOB, emailMessageSchema.parse(message), {
      // Messages may carry one-time codes: don't keep them in Redis longer
      // than needed to retry or debug a failure.
      removeOnComplete:
        options.retainForSeconds === undefined
          ? true
          : { age: options.retainForSeconds },
      removeOnFail: { age: options.retainForSeconds ?? DAY_SECONDS },
      jobId: options.jobId,
    });
  }

  async delivery(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return { state: 'missing' as const };
    const state = await job.getState();
    if (state === 'completed' && job.finishedOn)
      return { state: 'sent' as const, sentAt: new Date(job.finishedOn) };
    if (state === 'failed') {
      const rejected =
        job.attemptsMade === 1 &&
        /^Resend rejected the email with HTTP (400|401|403|404|422)$/.test(
          job.failedReason ?? '',
        );
      return { state: rejected ? ('rejected' as const) : ('failed' as const) };
    }
    return { state: 'pending' as const };
  }
  async retryDelivery(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job && (await job.getState()) === 'failed') await job.retry();
  }

  /** Sends a one-time code (email verification, password reset). */
  async sendOtp(input: OtpEmailInput): Promise<void> {
    await this.send(renderOtpEmail({ ...input, webUrl: this.env.WEB_URL }));
  }

  /** Tells the owner of an email that someone tried to sign up with it. */
  async sendAccountExists(input: AccountExistsEmailInput): Promise<void> {
    await this.send(
      renderAccountExistsEmail({ ...input, webUrl: this.env.WEB_URL }),
    );
  }

  /** Tells a Contributor that their Track's notes are ready. */
  async sendTrackCompleted(
    input: TrackEmailInput,
    options: EmailSendOptions = {},
  ): Promise<void> {
    await this.send(
      renderTrackCompletedEmail({ ...input, webUrl: this.env.WEB_URL }),
      options,
    );
  }

  /** Tells a Contributor that their Track's Processing failed. */
  async sendTrackFailed(
    input: TrackEmailInput,
    options: EmailSendOptions = {},
  ): Promise<void> {
    await this.send(
      renderTrackFailedEmail({ ...input, webUrl: this.env.WEB_URL }),
      options,
    );
  }
}
