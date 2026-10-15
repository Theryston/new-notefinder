import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { type OnModuleInit } from '@nestjs/common';
import { type Job, type Queue, UnrecoverableError } from 'bullmq';
import {
  STREAK_REMINDER_JOB,
  STREAK_REMINDER_QUEUE,
  streakReminderJobSchema,
} from './streak-reminder.job.js';
import { StreakReminderService } from './streak-reminder.service.js';

@Processor(STREAK_REMINDER_QUEUE, { concurrency: 1 })
export class StreakReminderProcessor
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    private readonly reminders: StreakReminderService,
    @InjectQueue(STREAK_REMINDER_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Half-hour and quarter-hour zones need their own UTC offset within the
    // hour. Every scheduler still runs once hourly, at local minute zero.
    for (const minute of [0, 15, 30, 45]) {
      await this.queue.upsertJobScheduler(
        `hourly-practice-reminders-${minute}`,
        { pattern: `${minute} * * * *`, tz: 'UTC' },
        { name: STREAK_REMINDER_JOB, data: {} },
      );
    }
  }

  async process(job: Job<unknown>): Promise<void> {
    if (
      job.name !== STREAK_REMINDER_JOB ||
      !streakReminderJobSchema.safeParse(job.data).success
    ) {
      throw new UnrecoverableError('Invalid practice reminder job');
    }
    await this.reminders.sendDue();
  }
}
