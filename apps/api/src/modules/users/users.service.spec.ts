import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { cacheTags, currentUserSchema } from '@notefinder/contracts';
import { createImage, describeImage } from '../../../test/utils/images.js';
import { AppException } from '../../common/errors/app-exception.js';
import { ZodValidationException } from '../../common/zod/zod-validation.pipe.js';
import {
  StorageError,
  StorageService,
} from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { type CurrentUserRow, UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const repository = {
    findCurrentUser: vi.fn(),
    updateName: vi.fn(),
    updateNameAndImage: vi.fn(),
    setUsernameIfUnset: vi.fn(),
  };
  const webRevalidation = { revalidate: vi.fn() };
  const storage = { putPublicObject: vi.fn(), publicUrl: vi.fn() };

  beforeEach(async () => {
    repository.findCurrentUser.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: webRevalidation },
        { provide: StorageService, useValue: storage },
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

  describe('setUsername', () => {
    const ana: CurrentUserRow = {
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      emailVerified: true,
      username: 'ana_maria',
      image: null,
      role: 'USER',
      createdAt: new Date('2024-05-01T12:00:00.000Z'),
    };

    beforeEach(() => {
      repository.setUsernameIfUnset.mockReset();
    });

    it('stores the username lowercased and returns the user', async () => {
      repository.setUsernameIfUnset.mockResolvedValue({
        status: 'set',
        user: ana,
      });

      const user = await service.setUsername('u1', 'Ana_Maria');

      expect(repository.setUsernameIfUnset).toHaveBeenCalledWith(
        'u1',
        'ana_maria',
      );
      expect(user).toEqual({ ...ana, createdAt: '2024-05-01T12:00:00.000Z' });
      expect(currentUserSchema.parse(user)).toEqual(user);
    });

    it('answers CONFLICT when another user has the username', async () => {
      repository.setUsernameIfUnset.mockResolvedValue({ status: 'taken' });

      await expect(service.setUsername('u1', 'ana')).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      expect(repository.findCurrentUser).not.toHaveBeenCalled();
    });

    it('answers CONFLICT when the user already has a username', async () => {
      repository.setUsernameIfUnset.mockResolvedValue({
        status: 'not-updated',
      });
      repository.findCurrentUser.mockResolvedValue(ana);

      const result = service.setUsername('u1', 'other');

      await expect(result).rejects.toBeInstanceOf(AppException);
      await expect(result).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('answers UNAUTHORIZED when the user no longer exists', async () => {
      repository.setUsernameIfUnset.mockResolvedValue({
        status: 'not-updated',
      });
      repository.findCurrentUser.mockResolvedValue(undefined);

      await expect(service.setUsername('gone', 'ana')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
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

    describe('and the Avatar', () => {
      const PUBLIC_BASE = 'https://files.example.com';
      const avatarFile = async (format: 'png' | 'jpeg' | 'webp' = 'png') =>
        new File(
          [new Uint8Array(await createImage({ format }))],
          `me.${format}`,
          {
            type: `image/${format}`,
          },
        );

      beforeEach(() => {
        repository.updateNameAndImage.mockReset();
        storage.putPublicObject.mockReset();
        storage.publicUrl.mockReset();
        storage.putPublicObject.mockResolvedValue(undefined);
        storage.publicUrl.mockImplementation(
          (key: string) => `${PUBLIC_BASE}/${key}`,
        );
        repository.updateNameAndImage.mockResolvedValue({
          ...ada,
          name: 'Ada King',
          image: `${PUBLIC_BASE}/avatars/u1.webp?cacheBust=1`,
        });
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-29T12:00:00.000Z'));
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it.each(['png', 'jpeg', 'webp'] as const)(
        'stores a %s as a public 512x512 webp under the user key',
        async (format) => {
          await service.updateProfile('u1', {
            name: 'Ada King',
            avatar: await avatarFile(format),
          });

          expect(storage.putPublicObject).toHaveBeenCalledTimes(1);
          const [object] = storage.putPublicObject.mock.lastCall ?? [];
          expect(object).toMatchObject({
            key: 'avatars/u1.webp',
            contentType: 'image/webp',
          });
          expect(await describeImage(object.body)).toMatchObject({
            format: 'webp',
            width: 512,
            height: 512,
          });
        },
      );

      it('saves the Name and the image URL in one update', async () => {
        await service.updateProfile('u1', {
          name: 'Ada King',
          avatar: await avatarFile(),
        });

        expect(repository.updateNameAndImage).toHaveBeenCalledTimes(1);
        expect(repository.updateNameAndImage).toHaveBeenCalledWith(
          'u1',
          'Ada King',
          `${PUBLIC_BASE}/avatars/u1.webp?cacheBust=${Date.now()}`,
        );
        expect(repository.updateName).not.toHaveBeenCalled();
      });

      it('changes the image URL with every upload', async () => {
        const first = await service.updateProfile('u1', {
          name: 'Ada King',
          avatar: await avatarFile(),
        });
        vi.setSystemTime(new Date('2026-09-29T12:00:01.000Z'));
        const second = await service.updateProfile('u1', {
          name: 'Ada King',
          avatar: await avatarFile(),
        });

        const urls = repository.updateNameAndImage.mock.calls.map(
          ([, , image]) => image,
        );
        expect(new Set(urls).size).toBe(2);
        expect(urls.every((url) => url.startsWith(`${PUBLIC_BASE}/`))).toBe(
          true,
        );
        expect([first.id, second.id]).toEqual(['u1', 'u1']);
      });

      it('writes only after the file is stored', async () => {
        await service.updateProfile('u1', {
          name: 'Ada King',
          avatar: await avatarFile(),
        });

        const stored = storage.putPublicObject.mock.invocationCallOrder[0];
        const written =
          repository.updateNameAndImage.mock.invocationCallOrder[0];
        expect(stored).toBeLessThan(written ?? 0);
      });

      it('returns the user as saved and revalidates the Profile', async () => {
        const user = await service.updateProfile('u1', {
          name: 'Ada King',
          avatar: await avatarFile(),
        });

        expect(user).toMatchObject({
          name: 'Ada King',
          image: `${PUBLIC_BASE}/avatars/u1.webp?cacheBust=1`,
        });
        expect(currentUserSchema.parse(user)).toEqual(user);
        expect(webRevalidation.revalidate).toHaveBeenCalledWith([
          cacheTags.userProfile('ada_l'),
        ]);
      });

      it('logs why the file could not be stored, and still fails', async () => {
        const logged = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
        const failure = new StorageError('Could not store "avatars/u1.webp"', {
          cause: new Error('The specified bucket does not exist'),
        });
        storage.putPublicObject.mockRejectedValue(failure);

        await expect(
          service.updateProfile('u1', {
            name: 'Ada King',
            avatar: await avatarFile(),
          }),
        ).rejects.toBe(failure);

        expect(logged).toHaveBeenCalledWith(
          'Could not store the Avatar: The specified bucket does not exist',
        );
        logged.mockRestore();
      });

      it('writes nothing when the file could not be stored', async () => {
        const logged = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
        const failure = new StorageError('Could not store the Avatar');
        storage.putPublicObject.mockRejectedValue(failure);

        await expect(
          service.updateProfile('u1', {
            name: 'Ada King',
            avatar: await avatarFile(),
          }),
        ).rejects.toBe(failure);

        expect(repository.updateNameAndImage).not.toHaveBeenCalled();
        expect(repository.updateName).not.toHaveBeenCalled();
        expect(webRevalidation.revalidate).not.toHaveBeenCalled();
        logged.mockRestore();
      });

      it('stores and writes nothing for a file that is not an image', async () => {
        const disguised = new File(['<script>alert(1)</script>'], 'me.png', {
          type: 'image/png',
        });

        const result = service.updateProfile('u1', {
          name: 'Ada King',
          avatar: disguised,
        });

        await expect(result).rejects.toBeInstanceOf(ZodValidationException);
        expect(storage.putPublicObject).not.toHaveBeenCalled();
        expect(repository.updateNameAndImage).not.toHaveBeenCalled();
        expect(webRevalidation.revalidate).not.toHaveBeenCalled();
      });

      it('leaves the image alone, and stores nothing, without an Avatar', async () => {
        await service.updateProfile('u1', { name: 'Ada King' });

        expect(storage.putPublicObject).not.toHaveBeenCalled();
        expect(repository.updateNameAndImage).not.toHaveBeenCalled();
        expect(repository.updateName).toHaveBeenCalledWith('u1', 'Ada King');
      });

      it('rejects with UNAUTHORIZED when the user no longer exists', async () => {
        repository.updateNameAndImage.mockResolvedValue(undefined);

        await expect(
          service.updateProfile('gone', {
            name: 'Ada King',
            avatar: await avatarFile(),
          }),
        ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(webRevalidation.revalidate).not.toHaveBeenCalled();
      });
    });

    it('rejects with UNAUTHORIZED when the user no longer exists', async () => {
      repository.updateName.mockResolvedValue(undefined);

      const result = service.updateProfile('gone', { name: 'Ada King' });

      await expect(result).rejects.toBeInstanceOf(AppException);
      await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(webRevalidation.revalidate).not.toHaveBeenCalled();
    });
  });
});
