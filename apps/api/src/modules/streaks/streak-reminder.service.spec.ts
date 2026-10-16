import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { ENV } from '../../config/env.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { EmailService } from '../../integrations/email/email.service.js';
import { STREAK_REMINDER_QUEUE } from './streak-reminder.job.js';
import { StreakReminderProcessor } from './streak-reminder.processor.js';
import { StreakReminderRepository } from './streak-reminder.repository.js';
import { StreakReminderService } from './streak-reminder.service.js';

const recipient = {
  id: 'user-1',
  email: 'one@example.com',
  locale: 'en',
  day: '2026-03-10',
};
const repository = { findDue: vi.fn(), reserve: vi.fn() };
const emails = { send: vi.fn() };
const queue = { upsertJobScheduler: vi.fn() };

describe('Practice reminder job', () => {
  let module: TestingModule;
  let service: StreakReminderService;
  beforeEach(async () => {
    vi.resetAllMocks();
    repository.findDue.mockResolvedValue([recipient]);
    repository.reserve.mockResolvedValue(true);
    const { db, pool } = fakeTransactionalDatabase();
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        StreakReminderService,
        StreakReminderProcessor,
        { provide: StreakReminderRepository, useValue: repository },
        { provide: EmailService, useValue: emails },
        { provide: ENV, useValue: { WEB_URL: 'https://notefinder.test' } },
        { provide: getQueueToken(STREAK_REMINDER_QUEUE), useValue: queue },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = module.get(StreakReminderService);
  });
  afterEach(async () => module.close());

  it('queues localized mail with a persistent per-day idempotency key', async () => {
    const now = new Date('2026-03-10T19:00:00Z');
    await service.sendDue(now);
    expect(repository.findDue).toHaveBeenCalledWith(now);
    expect(repository.reserve).toHaveBeenCalledWith(
      'user-1',
      '2026-03-10',
      now,
    );
    expect(emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipient.email,
        text: expect.stringContaining('https://notefinder.test/en'),
      }),
      { jobId: 'streak-reminder-user-1-2026-03-10', retainForSeconds: 172800 },
    );
  });
  it('does not send when another worker or heartbeat has already finished the day', async () => {
    repository.reserve.mockResolvedValue(false);
    await service.sendDue();
    expect(emails.send).not.toHaveBeenCalled();
  });
  it('logs a failed delivery and continues with the next User', async () => {
    repository.findDue.mockResolvedValue([
      recipient,
      { ...recipient, id: 'user-2' },
    ]);
    emails.send.mockRejectedValueOnce(new Error('Queue unavailable'));
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    await service.sendDue();
    expect(emails.send).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      'Practice reminder failed for User user-1',
      expect.any(Error),
    );
    log.mockRestore();
  });
  it('registers hourly schedules at every current IANA offset within the hour', async () => {
    await module.get(StreakReminderProcessor).onModuleInit();
    expect(queue.upsertJobScheduler.mock.calls).toEqual(
      [0, 15, 30, 45].map((minute) => [
        `hourly-practice-reminders-${minute}`,
        { pattern: `${minute} * * * *`, tz: 'UTC' },
        { name: 'send-due', data: {} },
      ]),
    );
  });
  it('runs the scheduled selection and refuses malformed jobs', async () => {
    const redis = new Queue('test', { connection: { lazyConnect: true } });
    const processor = module.get(StreakReminderProcessor);
    try {
      await processor.process(new Job(redis, 'send-due', {}));
      expect(emails.send).toHaveBeenCalledTimes(1);
      await expect(
        processor.process(new Job(redis, 'other', {})),
      ).rejects.toThrow('Invalid practice reminder job');
      await expect(
        processor.process(new Job(redis, 'send-due', { userId: 'unexpected' })),
      ).rejects.toThrow('Invalid practice reminder job');
    } finally {
      await redis.close();
    }
  });
});
