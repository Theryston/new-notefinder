import { Test } from '@nestjs/testing';
import { AttemptsService } from '../attempts/attempts.service.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { TrackContributionsService } from '../tracks/track-contributions.service.js';
import { ProfileSummaryService } from './profile-summary.service.js';

const streaks = { getStatus: vi.fn() };
const attempts = { countSung: vi.fn() };
const favorites = { countFavorites: vi.fn() };
const contributions = { countOf: vi.fn() };

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
        { provide: TrackContributionsService, useValue: contributions },
      ],
    }).compile();
    service = moduleRef.get(ProfileSummaryService);
  });

  it('reads each number from the module that owns it, for the User given', async () => {
    streaks.getStatus.mockResolvedValue({ currentStreakDays: 4 });
    attempts.countSung.mockResolvedValue(12);
    favorites.countFavorites.mockResolvedValue(3);
    contributions.countOf.mockResolvedValue(7);

    const summary = await service.getSummary('user-1');

    expect(streaks.getStatus).toHaveBeenCalledWith('user-1', undefined);
    expect(attempts.countSung).toHaveBeenCalledWith('user-1');
    expect(favorites.countFavorites).toHaveBeenCalledWith('user-1');
    expect(contributions.countOf).toHaveBeenCalledWith('user-1');
    expect(summary).toEqual({
      streakDays: 4,
      sungCount: 12,
      favoritesCount: 3,
      contributionsCount: 7,
    });
  });

  it("leaves the time zone to the streak, so the owner's stored zone decides the day", async () => {
    streaks.getStatus.mockResolvedValue({ currentStreakDays: 0 });
    attempts.countSung.mockResolvedValue(0);
    favorites.countFavorites.mockResolvedValue(0);
    contributions.countOf.mockResolvedValue(0);

    await service.getSummary('user-3');

    // A zone passed here would be the visitor's; the owner's clock is the one
    // the streak must read.
    expect(streaks.getStatus).toHaveBeenCalledTimes(1);
    expect(streaks.getStatus).toHaveBeenCalledWith('user-3', undefined);
  });

  it('answers zeros for a User with no data', async () => {
    streaks.getStatus.mockResolvedValue({ currentStreakDays: 0 });
    attempts.countSung.mockResolvedValue(0);
    favorites.countFavorites.mockResolvedValue(0);
    contributions.countOf.mockResolvedValue(0);

    await expect(service.getSummary('user-2')).resolves.toEqual({
      streakDays: 0,
      sungCount: 0,
      favoritesCount: 0,
      contributionsCount: 0,
    });
  });
});
