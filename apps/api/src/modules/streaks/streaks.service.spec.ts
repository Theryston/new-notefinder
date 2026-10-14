import { Test, type TestingModule } from '@nestjs/testing';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { UsersService } from '../users/users.service.js';
import { StreaksRepository } from './streaks.repository.js';
import { StreaksService } from './streaks.service.js';

const repository = {
  findDay: vi.fn(),
  lockDay: vi.fn(),
  saveHeartbeat: vi.fn(),
  findCompletedDays: vi.fn(),
};
const users = { getPracticeSettings: vi.fn(), setTimeZone: vi.fn() };

const NOW = new Date('2026-03-10T12:00:00Z');
const day = (overrides = {}) => ({
  id: 'day-1',
  day: '2026-03-10',
  listenedSeconds: 0,
  completed: false,
  lastHeartbeatAt: null,
  ...overrides,
});

describe('StreaksService', () => {
  let service: StreaksService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    users.getPracticeSettings.mockResolvedValue({
      dailyPracticeTargetSeconds: null,
      timeZone: 'UTC',
    });
    repository.findCompletedDays.mockResolvedValue([]);
    const { db, pool } = fakeTransactionalDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        StreaksService,
        { provide: StreaksRepository, useValue: repository },
        { provide: UsersService, useValue: users },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(StreaksService);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await moduleRef.close();
  });

  it('reads the status against the default target without a stored day', async () => {
    repository.findDay.mockResolvedValue(undefined);

    await expect(service.getStatus('user-1', undefined)).resolves.toEqual({
      day: '2026-03-10',
      listenedSeconds: 0,
      targetSeconds: 300,
      completedToday: false,
      currentStreakDays: 0,
    });
  });

  it('reads the day in the zone asked for before the stored one', async () => {
    users.getPracticeSettings.mockResolvedValue({
      dailyPracticeTargetSeconds: 900,
      timeZone: 'Asia/Tokyo',
    });
    vi.setSystemTime(new Date('2026-03-10T16:00:00Z'));
    repository.findDay.mockResolvedValue(undefined);

    const stored = await service.getStatus('user-1', undefined);
    const asked = await service.getStatus('user-1', 'America/Sao_Paulo');

    expect(stored.day).toBe('2026-03-11');
    expect(asked.day).toBe('2026-03-10');
    expect(asked.targetSeconds).toBe(900);
  });

  it('caps the listened seconds at the target', async () => {
    users.getPracticeSettings.mockResolvedValue({
      dailyPracticeTargetSeconds: 60,
      timeZone: null,
    });
    repository.findDay.mockResolvedValue(day({ listenedSeconds: 500 }));

    await expect(service.getStatus('user-1', undefined)).resolves.toMatchObject(
      { listenedSeconds: 60, completedToday: false },
    );
  });

  it('keeps the time zone only when the heartbeat changes it', async () => {
    repository.lockDay.mockResolvedValue(day());

    await service.heartbeat('user-1', { elapsedSeconds: 5, timeZone: 'UTC' });
    expect(users.setTimeZone).not.toHaveBeenCalled();

    await service.heartbeat('user-1', {
      elapsedSeconds: 5,
      timeZone: 'Asia/Tokyo',
    });
    expect(users.setTimeZone).toHaveBeenCalledWith('user-1', 'Asia/Tokyo');
  });

  it('completes the day on the heartbeat that reaches the target', async () => {
    users.getPracticeSettings.mockResolvedValue({
      dailyPracticeTargetSeconds: 30,
      timeZone: 'UTC',
    });
    repository.lockDay.mockResolvedValue(
      day({
        listenedSeconds: 20,
        lastHeartbeatAt: new Date(NOW.getTime() - 60_000),
      }),
    );

    const result = await service.heartbeat('user-1', {
      elapsedSeconds: 15,
      timeZone: 'UTC',
    });

    expect(result).toMatchObject({ justCompleted: true, creditedSeconds: 15 });
    expect(repository.saveHeartbeat).toHaveBeenCalledWith('day-1', {
      listenedSeconds: 35,
      heartbeatAt: NOW,
      completesDay: true,
    });
  });

  it('does not complete a day twice', async () => {
    repository.lockDay.mockResolvedValue(
      day({ listenedSeconds: 400, completed: true }),
    );

    const result = await service.heartbeat('user-1', {
      elapsedSeconds: 5,
      timeZone: 'UTC',
    });

    expect(result.justCompleted).toBe(false);
    expect(repository.saveHeartbeat).toHaveBeenCalledWith(
      'day-1',
      expect.objectContaining({ completesDay: false }),
    );
  });

  it('writes nothing for a heartbeat with less than a second', async () => {
    repository.lockDay.mockResolvedValue(day());

    const result = await service.heartbeat('user-1', {
      elapsedSeconds: 0.4,
      timeZone: 'UTC',
    });

    expect(result.creditedSeconds).toBe(0);
    expect(repository.saveHeartbeat).not.toHaveBeenCalled();
  });
});
