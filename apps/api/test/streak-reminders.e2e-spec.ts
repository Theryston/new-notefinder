import { Logger } from '@nestjs/common';
import { dailyPracticeStreaks } from '../src/database/schema/daily-practice-streaks.js';
import { EmailService } from '../src/integrations/email/email.service.js';
import { StreakReminderService } from '../src/modules/streaks/streak-reminder.service.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createUser } from './utils/factories.js';

describe('Practice reminders (e2e)', () => {
  let app: TestApp;
  const send = vi.fn().mockResolvedValue(undefined);
  beforeAll(async () => {
    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(EmailService).useValue({ send }),
    });
  });
  afterAll(async () => app?.close());
  beforeEach(async () => {
    await resetDatabase(app.db);
    send.mockReset().mockResolvedValue(undefined);
  });
  const seed = async (timeZone: string | null, day = '2026-03-09') => {
    const user = await createUser(app.db, { timeZone });
    await app.db
      .insert(dailyPracticeStreaks)
      .values({ userId: user.id, day, completed: true });
    return user;
  };
  it('selects local 19:00 in different zones and never repeats the local day', async () => {
    const brazil = await seed('America/Sao_Paulo');
    const tokyo = await seed('Asia/Tokyo');
    const utc = await seed('UTC');
    await seed(null);
    await seed('America/New_York');
    const reminders = app.app.get(StreakReminderService);
    await reminders.sendDue(new Date('2026-03-10T22:00:00Z'));
    expect(send.mock.calls.map(([message]) => message.to)).toEqual([
      brazil.email,
    ]);
    await reminders.sendDue(new Date('2026-03-10T22:30:00Z'));
    expect(send).toHaveBeenCalledTimes(1);
    await reminders.sendDue(new Date('2026-03-10T10:00:00Z'));
    await reminders.sendDue(new Date('2026-03-10T19:00:00Z'));
    expect(send.mock.calls.map(([message]) => message.to)).toEqual([
      brazil.email,
      tokyo.email,
      utc.email,
    ]);
  });
  it('ignores a completed today, an incomplete yesterday and an older completion', async () => {
    const done = await seed('UTC');
    await app.db
      .insert(dailyPracticeStreaks)
      .values({ userId: done.id, day: '2026-03-10', completed: true });
    const incomplete = await createUser(app.db, { timeZone: 'UTC' });
    await app.db
      .insert(dailyPracticeStreaks)
      .values({ userId: incomplete.id, day: '2026-03-09', completed: false });
    await seed('UTC', '2026-03-08');
    await app.app
      .get(StreakReminderService)
      .sendDue(new Date('2026-03-10T19:00:00Z'));
    expect(send).not.toHaveBeenCalled();
  });

  it('isolates and logs enqueue failures, allowing a later retry', async () => {
    const first = await seed('UTC');
    const second = await seed('UTC');
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    send.mockRejectedValueOnce(new Error('Queue unavailable'));
    const service = app.app.get(StreakReminderService);
    await service.sendDue(new Date('2026-03-10T19:00:00Z'));
    expect(send).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(first.id),
      expect.any(Error),
    );
    await service.sendDue(new Date('2026-03-10T19:00:30Z'));
    expect(send.mock.calls.map(([message]) => message.to)).toEqual([
      first.email,
      second.email,
      first.email,
    ]);
    log.mockRestore();
  });

  it('keeps one reminder when concurrent workers select the same User', async () => {
    await seed('UTC');
    const service = app.app.get(StreakReminderService);
    await Promise.all([
      service.sendDue(new Date('2026-03-10T19:00:00Z')),
      service.sendDue(new Date('2026-03-10T19:00:00Z')),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('uses local calendar days across the UTC date boundary and DST', async () => {
    const island = await seed('Pacific/Kiritimati', '2026-03-10');
    await seed('America/New_York');
    const service = app.app.get(StreakReminderService);
    await service.sendDue(new Date('2026-03-11T05:00:00Z'));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: island.email }),
      expect.any(Object),
    );
    await service.sendDue(new Date('2026-03-10T23:00:00Z'));
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('sends at exactly 19:00 for half-hour and quarter-hour zones', async () => {
    const india = await seed('Asia/Kolkata');
    const nepal = await seed('Asia/Kathmandu');
    const service = app.app.get(StreakReminderService);
    await service.sendDue(new Date('2026-03-10T13:00:00Z'));
    expect(send).not.toHaveBeenCalled();
    await service.sendDue(new Date('2026-03-10T13:15:00Z'));
    expect(send.mock.calls.map(([message]) => message.to)).toEqual([
      nepal.email,
    ]);
    await service.sendDue(new Date('2026-03-10T13:30:00Z'));
    expect(send.mock.calls.map(([message]) => message.to)).toEqual([
      nepal.email,
      india.email,
    ]);
    await service.sendDue(new Date('2026-03-10T13:45:00Z'));
    expect(send).toHaveBeenCalledTimes(2);
  });
});
