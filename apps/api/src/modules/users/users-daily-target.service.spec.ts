import { Test } from '@nestjs/testing';
import { createImage } from '../../../test/utils/images.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { type CurrentUserRow, UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

const row = (overrides: Partial<CurrentUserRow> = {}): CurrentUserRow => ({
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  username: 'ada',
  image: null,
  role: 'USER',
  createdAt: new Date('2024-05-01T12:00:00.000Z'),
  dailyPracticeTargetSeconds: null,
  ...overrides,
});

describe('UsersService (daily target)', () => {
  let service: UsersService;
  const repository = {
    findCurrentUser: vi.fn(),
    updateName: vi.fn(),
    updateNameAndImage: vi.fn(),
    updateNameAndTarget: vi.fn(),
    updateNameImageAndTarget: vi.fn(),
  };
  const webRevalidation = { revalidate: vi.fn() };
  const storage = { putPublicObject: vi.fn(), publicUrl: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    repository.updateName.mockResolvedValue(row());
    repository.updateNameAndTarget.mockResolvedValue(row());
    repository.updateNameAndImage.mockResolvedValue(row());
    repository.updateNameImageAndTarget.mockResolvedValue(row());
    webRevalidation.revalidate.mockResolvedValue(undefined);
    storage.putPublicObject.mockResolvedValue(undefined);
    storage.publicUrl.mockImplementation(
      (key: string) => `https://files.example.com/${key}`,
    );
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

  it('saves the Name and the picked target without touching the image', async () => {
    await service.updateProfile('u1', {
      name: 'Ada King',
      dailyPracticeTargetSeconds: 900,
    });

    expect(repository.updateNameAndTarget).toHaveBeenCalledWith(
      'u1',
      'Ada King',
      900,
    );
    expect(repository.updateName).not.toHaveBeenCalled();
    expect(repository.updateNameAndImage).not.toHaveBeenCalled();
    expect(storage.putPublicObject).not.toHaveBeenCalled();
  });

  it('stores the Avatar first, then saves the Name, image and target together', async () => {
    const avatar = new File(
      [new Uint8Array(await createImage({ format: 'png' }))],
      'me.png',
      { type: 'image/png' },
    );

    await service.updateProfile('u1', {
      name: 'Ada King',
      avatar,
      dailyPracticeTargetSeconds: 600,
    });

    expect(storage.putPublicObject).toHaveBeenCalledTimes(1);
    expect(repository.updateNameImageAndTarget).toHaveBeenCalledWith(
      'u1',
      'Ada King',
      expect.stringMatching(/^https:\/\/files\.example\.com\/avatars\//),
      600,
    );
    expect(repository.updateName).not.toHaveBeenCalled();
    expect(repository.updateNameAndImage).not.toHaveBeenCalled();
    expect(repository.updateNameAndTarget).not.toHaveBeenCalled();
  });

  it.each([300, 600, 900, 1800])(
    'reads back the stored %i seconds preset',
    async (dailyPracticeTargetSeconds) => {
      repository.findCurrentUser.mockResolvedValue(
        row({ dailyPracticeTargetSeconds }),
      );

      const user = await service.getCurrentUser('u1');

      expect(user.dailyPracticeTargetSeconds).toBe(dailyPracticeTargetSeconds);
    },
  );

  it('reads a legacy non-preset value as the fallback', async () => {
    repository.findCurrentUser.mockResolvedValue(
      row({ dailyPracticeTargetSeconds: 40 }),
    );

    const user = await service.getCurrentUser('u1');

    expect(user.dailyPracticeTargetSeconds).toBeNull();
  });
});
