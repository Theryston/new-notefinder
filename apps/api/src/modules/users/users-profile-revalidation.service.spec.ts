import { Test } from '@nestjs/testing';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

const repository = { findCurrentUser: vi.fn() };
const webRevalidation = { revalidate: vi.fn() };

describe('UsersService.revalidatePublicProfile', () => {
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: webRevalidation },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it("revalidates the cached Profile tag of the User's username", async () => {
    repository.findCurrentUser.mockResolvedValue({ username: 'ada_lovelace' });

    await service.revalidatePublicProfile('user-1');

    expect(repository.findCurrentUser).toHaveBeenCalledWith('user-1');
    expect(webRevalidation.revalidate).toHaveBeenCalledWith([
      'user-profile:ada_lovelace',
    ]);
  });

  it('revalidates nothing for a User without a username yet', async () => {
    repository.findCurrentUser.mockResolvedValue({ username: null });

    await service.revalidatePublicProfile('user-1');

    expect(webRevalidation.revalidate).not.toHaveBeenCalled();
  });

  it('does not fail the save when the lookup fails', async () => {
    repository.findCurrentUser.mockRejectedValue(new Error('Database is down'));

    await expect(
      service.revalidatePublicProfile('user-1'),
    ).resolves.toBeUndefined();
    expect(webRevalidation.revalidate).not.toHaveBeenCalled();
  });
});
