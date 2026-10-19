import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

// The username lookup behind the public reads of a Profile: usernames are
// stored lowercase, so any casing finds the same User, and an unknown one is
// NOT_FOUND.
const repository = {
  findIdByUsername: vi.fn(),
};

describe('UsersService.findIdByUsername', () => {
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

  it('looks the username up lowercased and returns the ID of its User', async () => {
    repository.findIdByUsername.mockResolvedValue('user-7');

    await expect(service.findIdByUsername('Ada_Lovelace')).resolves.toBe(
      'user-7',
    );
    expect(repository.findIdByUsername).toHaveBeenCalledWith('ada_lovelace');
  });

  it('answers NOT_FOUND for a username no User has', async () => {
    repository.findIdByUsername.mockResolvedValue(undefined);

    const error = await service
      .findIdByUsername('nobody')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppException);
    expect(error).toMatchObject({ code: 'NOT_FOUND' });
    expect(repository.findIdByUsername).toHaveBeenCalledWith('nobody');
  });
});
