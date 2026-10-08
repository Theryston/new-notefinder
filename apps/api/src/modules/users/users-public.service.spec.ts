import { Test } from '@nestjs/testing';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

// The two reads the other modules use: a User's locale is written and the
// public fields of several Users are read in one call.
const repository = {
  setLocale: vi.fn(),
  findPublicUsers: vi.fn(),
};

describe('UsersService (locale and public profiles)', () => {
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

  it('writes the locale the User browses in', async () => {
    repository.setLocale.mockResolvedValue(undefined);

    await service.setLocale('user-1', 'pt-BR');

    expect(repository.setLocale).toHaveBeenCalledWith('user-1', 'pt-BR');
  });

  it('maps the public fields of the Users found by their IDs', async () => {
    repository.findPublicUsers.mockResolvedValue([
      { id: 'user-2', username: 'grace', name: 'Grace', image: null },
      { id: 'user-1', username: null, name: 'Ada', image: 'https://img/1' },
    ]);

    const profiles = await service.findPublicUsers(['user-1', 'user-2']);

    expect(repository.findPublicUsers).toHaveBeenCalledWith([
      'user-1',
      'user-2',
    ]);
    expect(profiles.get('user-1')).toEqual({
      id: 'user-1',
      username: null,
      name: 'Ada',
      image: 'https://img/1',
    });
    expect(profiles.get('user-2')).toMatchObject({ username: 'grace' });
    expect(profiles.has('user-3')).toBe(false);
  });
});
