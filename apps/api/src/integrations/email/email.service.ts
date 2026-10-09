import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
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

/**
 * Sends transactional email in the background (with retries), so a slow or
 * briefly unavailable provider never delays the request that triggered it.
 */
/** Options of one enqueue. */
export type EmailSendOptions = {
  /**
   * A job ID makes a repeated enqueue a no-op while the first job is pending, so
   * a replayed step sends an email once.
   */
  jobId?: string;
};

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailMessage>,
  ) {}

  /** @throws {ZodError} when the message is invalid. */
  async send(
    message: EmailMessage,
    options: EmailSendOptions = {},
  ): Promise<void> {
    await this.queue.add(EMAIL_JOB, emailMessageSchema.parse(message), {
      // Messages may carry one-time codes: don't keep them in Redis longer
      // than needed to retry or debug a failure.
      removeOnComplete: true,
      removeOnFail: { age: DAY_SECONDS },
      jobId: options.jobId,
    });
  }

  /** Sends a one-time code (email verification, password reset). */
  async sendOtp(input: OtpEmailInput): Promise<void> {
    await this.send(renderOtpEmail(input));
  }

  /** Tells the owner of an email that someone tried to sign up with it. */
  async sendAccountExists(input: AccountExistsEmailInput): Promise<void> {
    await this.send(renderAccountExistsEmail(input));
  }

  /** Tells a Contributor that their Track's notes are ready. */
  async sendTrackCompleted(
    input: TrackEmailInput,
    options: EmailSendOptions = {},
  ): Promise<void> {
    await this.send(renderTrackCompletedEmail(input), options);
  }

  /** Tells a Contributor that their Track's Processing failed. */
  async sendTrackFailed(
    input: TrackEmailInput,
    options: EmailSendOptions = {},
  ): Promise<void> {
    await this.send(renderTrackFailedEmail(input), options);
  }
}
