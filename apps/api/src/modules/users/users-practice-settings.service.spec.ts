import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

// What the daily practice streak reads and keeps about a User.
const repository = {
  findPracticeSettings: vi.fn(),
  lockPracticeSettings: vi.fn(),
  recordPracticeHeartbeat: vi.fn(),
};

describe('UsersService (practice settings)', () => {
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('reads the daily target and the time zone', async () => {
    const settings = {
      dailyPracticeTargetSeconds: 900,
      timeZone: 'UTC',
      lastPracticeHeartbeatAt: null,
    };
    repository.findPracticeSettings.mockResolvedValue(settings);

    await expect(service.getPracticeSettings('user-1')).resolves.toEqual(
      settings,
    );
    expect(repository.findPracticeSettings).toHaveBeenCalledWith('user-1');
  });

  it('answers UNAUTHORIZED for a User that is gone', async () => {
    repository.findPracticeSettings.mockResolvedValue(undefined);

    await expect(service.getPracticeSettings('user-1')).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it('locks the settings of a heartbeat, and answers UNAUTHORIZED for a User that is gone', async () => {
    const settings = {
      dailyPracticeTargetSeconds: null,
      timeZone: null,
      lastPracticeHeartbeatAt: null,
    };
    repository.lockPracticeSettings.mockResolvedValueOnce(settings);
    repository.lockPracticeSettings.mockResolvedValueOnce(undefined);

    await expect(service.lockPracticeSettings('user-1')).resolves.toEqual(
      settings,
    );
    await expect(service.lockPracticeSettings('user-1')).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it('keeps the time zone and moves the practice clock', async () => {
    repository.recordPracticeHeartbeat.mockResolvedValue(undefined);
    const clockAt = new Date('2026-03-10T12:00:00Z');

    await service.recordPracticeHeartbeat('user-1', {
      timeZone: 'Asia/Tokyo',
      clockAt,
    });

    expect(repository.recordPracticeHeartbeat).toHaveBeenCalledWith('user-1', {
      timeZone: 'Asia/Tokyo',
      clockAt,
    });
  });
});
