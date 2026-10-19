import { Test } from '@nestjs/testing';
import { AttemptsService } from '../attempts/attempts.service.js';
import { UserProfileService } from '../users/user-profile.service.js';
import { PublicProfileService } from './public-profile.service.js';

const userProfiles = { findPublicProfile: vi.fn() };
const attempts = { profileChips: vi.fn() };

const banner = {
  username: 'ada_lovelace',
  name: 'Ada Lovelace',
  image: null,
  createdAt: '2026-01-02T03:04:05.000Z',
};

describe('PublicProfileService', () => {
  let service: PublicProfileService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicProfileService,
        { provide: UserProfileService, useValue: userProfiles },
        { provide: AttemptsService, useValue: attempts },
      ],
    }).compile();
    service = moduleRef.get(PublicProfileService);
  });

  it('adds the chips the attempts decide to the banner', async () => {
    userProfiles.findPublicProfile.mockResolvedValue({
      userId: 'user-1',
      profile: { ...banner, dailyPracticeTargetSeconds: 600 },
    });
    attempts.profileChips.mockResolvedValue({
      vocalRange: { lowest: 50, highest: 74 },
      mostSungArtist: { id: 'artist-a', name: 'Artist A' },
    });

    await expect(service.getPublicProfile('Ada_Lovelace')).resolves.toEqual({
      ...banner,
      dailyPracticeTargetSeconds: 600,
      vocalRange: { lowest: 50, highest: 74 },
      mostSungArtist: { id: 'artist-a', name: 'Artist A' },
    });
    expect(userProfiles.findPublicProfile).toHaveBeenCalledWith('Ada_Lovelace');
    expect(attempts.profileChips).toHaveBeenCalledWith('user-1');
  });

  it('leaves out the chips with nothing to show, rather than sending null', async () => {
    userProfiles.findPublicProfile.mockResolvedValue({
      userId: 'user-1',
      profile: banner,
    });
    attempts.profileChips.mockResolvedValue({
      vocalRange: null,
      mostSungArtist: null,
    });

    const profile = await service.getPublicProfile('ada_lovelace');

    expect(profile).toEqual(banner);
    expect(profile).not.toHaveProperty('vocalRange');
    expect(profile).not.toHaveProperty('mostSungArtist');
    expect(profile).not.toHaveProperty('dailyPracticeTargetSeconds');
  });

  it('propagates NOT_FOUND from the banner lookup without reading attempts', async () => {
    const error = new Error('User not found');
    userProfiles.findPublicProfile.mockRejectedValue(error);

    await expect(service.getPublicProfile('nobody')).rejects.toBe(error);
    expect(attempts.profileChips).not.toHaveBeenCalled();
  });
});
