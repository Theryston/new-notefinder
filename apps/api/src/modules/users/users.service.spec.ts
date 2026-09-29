import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { cacheTags, currentUserSchema } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { type CurrentUserRow, UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const repository = { findCurrentUser: vi.fn(), updateName: vi.fn() };
  const webRevalidation = { revalidate: vi.fn() };

  beforeEach(async () => {
    repository.findCurrentUser.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: webRevalidation },
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

  describe('updateProfile', () => {
    const ada: CurrentUserRow = {
      id: 'u1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      emailVerified: true,
      username: 'Ada_L',
      image: 'https://example.com/ada.png',
      role: 'USER',
      createdAt: new Date('2024-05-01T12:00:00.000Z'),
    };

    beforeEach(() => {
      repository.updateName.mockReset();
      webRevalidation.revalidate.mockReset();
      repository.updateName.mockResolvedValue(ada);
      webRevalidation.revalidate.mockResolvedValue(undefined);
    });

    it('saves the Name and returns the user in the contract shape', async () => {
      const user = await service.updateProfile('u1', { name: 'Ada King' });

      expect(repository.updateName).toHaveBeenCalledWith('u1', 'Ada King');
      expect(user).toEqual({
        id: 'u1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        emailVerified: true,
        username: 'Ada_L',
        image: 'https://example.com/ada.png',
        role: 'USER',
        createdAt: '2024-05-01T12:00:00.000Z',
      });
      expect(currentUserSchema.parse(user)).toEqual(user);
    });

    it('revalidates the cached Profile of the Username', async () => {
      await service.updateProfile('u1', { name: 'Ada King' });

      expect(webRevalidation.revalidate).toHaveBeenCalledTimes(1);
      expect(webRevalidation.revalidate).toHaveBeenCalledWith([
        cacheTags.userProfile('ada_l'),
      ]);
    });

    it('has no Profile to revalidate before a Username is chosen', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockReturnValue();
      repository.updateName.mockResolvedValue({ ...ada, username: null });

      await service.updateProfile('u1', { name: 'Ada King' });

      expect(webRevalidation.revalidate).not.toHaveBeenCalled();
      // Not even attempted: a failed attempt would only be logged.
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it.each([
      ['an Error', new Error('redis is down'), 'redis is down'],
      ['something else', 'queue closed', 'queue closed'],
    ])(
      'still succeeds, and logs why, when enqueuing fails with %s',
      async (_label, failure, reason) => {
        const warn = vi.spyOn(Logger.prototype, 'warn').mockReturnValue();
        webRevalidation.revalidate.mockRejectedValue(failure);

        const user = await service.updateProfile('u1', { name: 'Ada King' });

        expect(user.name).toBe('Ada Lovelace');
        expect(warn).toHaveBeenCalledWith(
          `Could not enqueue the Profile revalidation: ${reason}`,
        );
        warn.mockRestore();
      },
    );

    it('rejects with UNAUTHORIZED when the user no longer exists', async () => {
      repository.updateName.mockResolvedValue(undefined);

      const result = service.updateProfile('gone', { name: 'Ada King' });

      await expect(result).rejects.toBeInstanceOf(AppException);
      await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(webRevalidation.revalidate).not.toHaveBeenCalled();
    });
  });
});
