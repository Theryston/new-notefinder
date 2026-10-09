import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { EmailService } from '../../integrations/email/email.service.js';
import type { TrackEmailInput } from '../../integrations/email/track-processing-email.js';
import { UsersService } from '../users/users.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { messageOf } from './track-processing-failure.js';

/** Sends one Contributor's email. */
type SendEmail = (input: TrackEmailInput) => Promise<void>;

/**
 * Tells the Contributors of a Processing that it ended (CONTEXT.md
 * "Contributor"): each gets an email in their own language with a link to the
 * Track. The runner calls it after every step job, so it runs once the status is
 * written. The claim on the Processing makes the emails go out once, however
 * many jobs run after the end. An email never fails the Processing: every error
 * is logged, and nothing is thrown.
 */
@Injectable()
export class TrackContributorEmailsService {
  private readonly logger = new Logger(TrackContributorEmailsService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly processings: TrackProcessingRepository,
    private readonly users: UsersService,
    private readonly emails: EmailService,
  ) {}

  /** Emails the Contributors of the Processing if it ended and was not emailed yet. Never throws. */
  async notifyIfEnded(processingId: string): Promise<void> {
    try {
      const ended = await this.processings.claimContributorEmails(processingId);
      if (ended === undefined) {
        return;
      }
      const sendEnded: SendEmail = (input) =>
        ended.status === 'COMPLETED'
          ? this.emails.sendTrackCompleted(input)
          : this.emails.sendTrackFailed(input);
      await this.notifyContributors(ended.trackId, sendEnded);
    } catch (error) {
      this.logger.error(
        `Could not email the Contributors of Processing ${processingId}: ${messageOf(error)}`,
      );
    }
  }

  private async notifyContributors(
    trackId: string,
    send: SendEmail,
  ): Promise<void> {
    const recipients = await this.recipientsOf(trackId);
    await Promise.all(
      recipients.map((recipient) => this.deliver(trackId, recipient, send)),
    );
  }

  /** One email; a failure is logged and leaves the other Contributors' emails alone. */
  private async deliver(
    trackId: string,
    recipient: TrackEmailInput,
    send: SendEmail,
  ): Promise<void> {
    try {
      await send(recipient);
    } catch (error) {
      this.logger.warn(
        `An email for Track ${trackId} was not queued: ${messageOf(error)}`,
      );
    }
  }

  private async recipientsOf(trackId: string): Promise<TrackEmailInput[]> {
    const contributors = await this.processings.findContributors(trackId);
    const users = await this.users.findEmailRecipients(
      contributors.map((contributor) => contributor.userId),
    );
    return [...users.values()].map((user) => ({
      to: user.email,
      locale: user.locale,
      trackUrl: `${this.env.WEB_URL}/${user.locale}/tracks/${trackId}`,
    }));
  }
}
