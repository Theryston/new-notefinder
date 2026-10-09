import { Inject, Injectable } from '@nestjs/common';
import type { TrackProcessingStatus } from '@notefinder/contracts';
import { ENV, type Env } from '../../config/env.js';
import { EmailService } from '../../integrations/email/email.service.js';
import type { EmailLocale } from '../../integrations/email/email-locale.js';
import type { TrackEmailInput } from '../../integrations/email/track-processing-email.js';
import { UsersService } from '../users/users.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { messageOf } from './track-processing-failure.js';

/** One Contributor's email, and the job ID that makes its enqueue repeatable. */
type Delivery = { email: TrackEmailInput; jobId: string };

/** The page of a Track in one language: the link every Track email carries. */
const trackPageUrl = (
  webUrl: string,
  locale: EmailLocale,
  trackId: string,
): string => `${webUrl}/${locale}/tracks/${trackId}`;

/**
 * Emails the Contributors of a Processing that ended (CONTEXT.md
 * "Contributor"): each gets an email in their own language with a link to the
 * Track. The runner calls it after every step job, once the status is written.
 *
 * It is at-least-once without duplicates. Each email's job ID is keyed by the
 * Processing and the User, so a replayed round finds its pending emails and
 * adds none. The Processing is marked emailed only after every enqueue
 * succeeded, so a failed round throws and BullMQ replays the step job, which
 * runs the round again. The Processing itself has already ended, so an email
 * failure never changes it.
 */
@Injectable()
export class TrackContributorEmailsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly processings: TrackProcessingRepository,
    private readonly users: UsersService,
    private readonly emails: EmailService,
  ) {}

  /** Queues the Processing's emails, once, when it has ended and they are still owed. */
  async notifyIfEnded(processingId: string): Promise<void> {
    const pending = await this.processings.findEndedWithoutEmails(processingId);
    if (pending === undefined) {
      return;
    }
    const deliveries = await this.deliveriesOf(processingId, pending.trackId);
    await this.enqueueAll(deliveries, pending.status);
    await this.processings.markContributorsEmailed(processingId);
  }

  /**
   * Enqueues every email, even when one is refused, so the others are queued
   * now and the replay only retries the refused ones. Throws when any was.
   */
  private async enqueueAll(
    deliveries: Delivery[],
    status: TrackProcessingStatus,
  ): Promise<void> {
    const settled = await Promise.allSettled(
      deliveries.map((delivery) => this.enqueue(delivery, status)),
    );
    const failures = settled.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    const [first] = failures;
    if (first !== undefined) {
      throw new Error(
        `${failures.length} of ${deliveries.length} Contributor emails were not queued: ${messageOf(first.reason)}`,
      );
    }
  }

  private enqueue(
    { email, jobId }: Delivery,
    status: TrackProcessingStatus,
  ): Promise<void> {
    return status === 'COMPLETED'
      ? this.emails.sendTrackCompleted(email, { jobId })
      : this.emails.sendTrackFailed(email, { jobId });
  }

  private async deliveriesOf(
    processingId: string,
    trackId: string,
  ): Promise<Delivery[]> {
    const contributors = await this.processings.findContributors(trackId);
    const users = await this.users.findEmailRecipients(
      contributors.map((contributor) => contributor.userId),
    );
    return [...users.values()].map((user) => ({
      email: {
        to: user.email,
        locale: user.locale,
        trackUrl: trackPageUrl(this.env.WEB_URL, user.locale, trackId),
      },
      jobId: `track-email-${processingId}-${user.id}`,
    }));
  }
}
