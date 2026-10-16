import { Inject, Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ENV, type Env } from '../../config/env.js';
import { EmailService } from '../../integrations/email/email.service.js';
import { renderStreakReminderEmail } from '../../integrations/email/streak-reminder-email.js';
import { StreakReminderRepository } from './streak-reminder.repository.js';

type Recipient = Awaited<
  ReturnType<StreakReminderRepository['findDue']>
>[number];

@Injectable()
export class StreakReminderService {
  private readonly logger = new Logger(StreakReminderService.name);
  constructor(
    private readonly reminders: StreakReminderRepository,
    private readonly emails: EmailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async sendDue(now = new Date()): Promise<void> {
    for (const recipient of await this.reminders.findDue(now)) {
      try {
        await this.deliver(recipient, now);
      } catch (error) {
        this.logger.error(
          `Practice reminder failed for User ${recipient.id}`,
          error,
        );
      }
    }
  }

  /** Roll back the marker when enqueue fails, so a retried job can try again. */
  @Transactional()
  async deliver(recipient: Recipient, now: Date): Promise<void> {
    if (!(await this.reminders.reserve(recipient.id, recipient.day, now))) {
      return;
    }
    await this.emails.send(
      renderStreakReminderEmail({
        to: recipient.email,
        locale: recipient.locale,
        siteUrl: `${this.env.WEB_URL}/${recipient.locale}`,
      }),
      {
        jobId: `streak-reminder-${recipient.id}-${recipient.day}`,
        // Keep delivered jobs past this local day in case the DB commit fails.
        retainForSeconds: 48 * 60 * 60,
      },
    );
  }
}
