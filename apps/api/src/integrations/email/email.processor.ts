import { Processor, WorkerHost } from '@nestjs/bullmq';
import { HttpStatus, Inject, Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { ENV, type Env } from '../../config/env.js';
import {
  EMAIL_QUEUE,
  type EmailMessage,
  emailMessageSchema,
} from './email.job.js';

const RESEND_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10_000;

const isRetryableStatus = (status: number): boolean =>
  status >= 500 ||
  status === HttpStatus.REQUEST_TIMEOUT ||
  status === HttpStatus.TOO_MANY_REQUESTS;

/**
 * Delivers queued emails through Resend's HTTP API. Retries reuse the job ID
 * as Resend's idempotency key, so a retry after a lost response never sends
 * the same email twice.
 *
 * Without `RESEND_API_KEY` (only allowed outside production) the email is
 * logged instead, so sign-up and password-reset codes show up in the dev
 * console.
 */
@Processor(EMAIL_QUEUE, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const parsed = emailMessageSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Invalid job payload (job ${job.id})`);
    }
    const message = parsed.data;

    if (this.env.RESEND_API_KEY === undefined) {
      this.logUnsent(message);
      return;
    }

    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `email-${job.id ?? job.name}`,
      },
      body: JSON.stringify({
        from: this.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.body?.cancel();

    if (!response.ok) {
      const error = `Resend rejected the email with HTTP ${response.status}`;
      throw isRetryableStatus(response.status)
        ? new Error(error)
        : new UnrecoverableError(error);
    }
    this.logger.log(`Sent email (job ${job.id})`);
  }

  private logUnsent(message: EmailMessage): void {
    if (this.env.NODE_ENV === 'production') {
      // Unreachable: the env schema requires the key in production. Never
      // log the message there, it may contain one-time codes.
      throw new UnrecoverableError('RESEND_API_KEY is not set');
    }
    this.logger.log(
      `RESEND_API_KEY is not set, email not sent:\n` +
        `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`,
    );
  }
}
