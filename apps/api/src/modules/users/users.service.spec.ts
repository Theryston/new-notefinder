import { Test } from '@nestjs/testing';
import { currentUserSchema } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const repository = { findCurrentUser: vi.fn() };

  beforeEach(async () => {
    repository.findCurrentUser.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('getCurrentUser', () => {
    it('returns the user in the contract shape', async () => {
      repository.findCurrentUser.mockResolvedValue({
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        emailVerified: true,
        username: 'ana',
        image: null,
        role: 'USER',
        createdAt: new Date('2024-05-01T12:00:00.000Z'),
      });

      const user = await service.getCurrentUser('u1');

      expect(repository.findCurrentUser).toHaveBeenCalledWith('u1');
      expect(user).toEqual({
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        emailVerified: true,
        username: 'ana',
        image: null,
        role: 'USER',
        createdAt: '2024-05-01T12:00:00.000Z',
      });
      expect(currentUserSchema.parse(user)).toEqual(user);
    });

    it('rejects with UNAUTHORIZED when the user no longer exists', async () => {
      repository.findCurrentUser.mockResolvedValue(undefined);

      const result = service.getCurrentUser('gone');
      await expect(result).rejects.toBeInstanceOf(AppException);
      await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });
});
