import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { UserProfileService } from './user-profile.service.js';
import { UsersRepository } from './users.repository.js';

const repository = {
  findPublicProfileByUsername: vi.fn(),
};

describe('UserProfileService', () => {
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

  it('reads the banner of the lowercased username and maps it', async () => {
    repository.findPublicProfileByUsername.mockResolvedValue({
      name: 'Ada Lovelace',
      image: null,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
    });

    const profile = await service.getPublicProfile('Ada_Lovelace');

    expect(repository.findPublicProfileByUsername).toHaveBeenCalledWith(
      'ada_lovelace',
    );
    expect(profile).toEqual({
      username: 'ada_lovelace',
      name: 'Ada Lovelace',
      image: null,
      createdAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('answers NOT_FOUND for a username no User has', async () => {
    repository.findPublicProfileByUsername.mockResolvedValue(undefined);

    const error = await service
      .getPublicProfile('nobody')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppException);
    expect(error).toMatchObject({ code: 'NOT_FOUND' });
  });
});
