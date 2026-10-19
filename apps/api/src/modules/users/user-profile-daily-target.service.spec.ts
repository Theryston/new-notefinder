import { Test } from '@nestjs/testing';
import { UserProfileService } from './user-profile.service.js';
import { UsersRepository } from './users.repository.js';

const repository = {
  findPublicProfileByUsername: vi.fn(),
};

const row = {
  id: 'user-1',
  name: 'Ada Lovelace',
  image: null,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
};

describe('UserProfileService (Daily target and User ID)', () => {
  let service: UserProfileService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(UserProfileService);
  });

  it('shows the Daily target when the User picked a preset', async () => {
    repository.findPublicProfileByUsername.mockResolvedValue({
      ...row,
      dailyPracticeTargetSeconds: 900,
    });

    const lookup = await service.findPublicProfile('ada_lovelace');

    expect(lookup.userId).toBe('user-1');
    expect(lookup.profile).toMatchObject({ dailyPracticeTargetSeconds: 900 });
  });

  it('leaves the Daily target out when none is set', async () => {
    repository.findPublicProfileByUsername.mockResolvedValue({
      ...row,
      dailyPracticeTargetSeconds: null,
    });

    const { profile } = await service.findPublicProfile('ada_lovelace');

    expect(profile).not.toHaveProperty('dailyPracticeTargetSeconds');
  });

  it('leaves out a stored value that is not a preset', async () => {
    repository.findPublicProfileByUsername.mockResolvedValue({
      ...row,
      dailyPracticeTargetSeconds: 420,
    });

    const { profile } = await service.findPublicProfile('ada_lovelace');

    expect(profile).not.toHaveProperty('dailyPracticeTargetSeconds');
  });
});
