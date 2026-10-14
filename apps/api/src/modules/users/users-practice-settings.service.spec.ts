import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

// What the daily practice streak reads and keeps about a User.
const repository = {
  findPracticeSettings: vi.fn(),
  setTimeZone: vi.fn(),
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
    const settings = { dailyPracticeTargetSeconds: 900, timeZone: 'UTC' };
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

  it('keeps the time zone', async () => {
    repository.setTimeZone.mockResolvedValue(undefined);

    await service.setTimeZone('user-1', 'Asia/Tokyo');

    expect(repository.setTimeZone).toHaveBeenCalledWith('user-1', 'Asia/Tokyo');
  });
});
