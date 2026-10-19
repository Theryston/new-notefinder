import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { AttemptsService } from '../attempts/attempts.service.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { ProfileSummaryRepository } from './profile-summary.repository.js';
import { ProfileSummaryService } from './profile-summary.service.js';

const streaks = { getStatus: vi.fn() };
const attempts = { countSung: vi.fn() };
const favorites = { countFavorites: vi.fn() };
const repository = {
  findUserIdByUsername: vi.fn(),
  countContributions: vi.fn(),
};

describe('ProfileSummaryService', () => {
  let service: ProfileSummaryService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileSummaryService,
        { provide: StreaksService, useValue: streaks },
        { provide: AttemptsService, useValue: attempts },
        { provide: FavoritesService, useValue: favorites },
        { provide: ProfileSummaryRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ProfileSummaryService);
  });

  it('reads each number from the module that owns it, for the looked-up User', async () => {
    repository.findUserIdByUsername.mockResolvedValue('user-1');
    streaks.getStatus.mockResolvedValue({ currentStreakDays: 4 });
    attempts.countSung.mockResolvedValue(12);
    favorites.countFavorites.mockResolvedValue(3);
    repository.countContributions.mockResolvedValue(7);

    const summary = await service.getSummary('Ada_Lovelace');

    expect(repository.findUserIdByUsername).toHaveBeenCalledWith(
      'ada_lovelace',
    );
    expect(streaks.getStatus).toHaveBeenCalledWith('user-1', undefined);
    expect(attempts.countSung).toHaveBeenCalledWith('user-1');
    expect(favorites.countFavorites).toHaveBeenCalledWith('user-1');
    expect(repository.countContributions).toHaveBeenCalledWith('user-1');
    expect(summary).toEqual({
      streakDays: 4,
      sungCount: 12,
      favoritesCount: 3,
      contributionsCount: 7,
    });
  });

  it('answers zeros for a User with no data', async () => {
    repository.findUserIdByUsername.mockResolvedValue('user-2');
    streaks.getStatus.mockResolvedValue({ currentStreakDays: 0 });
    attempts.countSung.mockResolvedValue(0);
    favorites.countFavorites.mockResolvedValue(0);
    repository.countContributions.mockResolvedValue(0);

    await expect(service.getSummary('new_user')).resolves.toEqual({
      streakDays: 0,
      sungCount: 0,
      favoritesCount: 0,
      contributionsCount: 0,
    });
  });

  it('answers NOT_FOUND for a username no User has, without reading the numbers', async () => {
    repository.findUserIdByUsername.mockResolvedValue(undefined);

    const error = await service
      .getSummary('nobody')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppException);
    expect(error).toMatchObject({ code: 'NOT_FOUND' });
    expect(streaks.getStatus).not.toHaveBeenCalled();
    expect(attempts.countSung).not.toHaveBeenCalled();
  });
});
