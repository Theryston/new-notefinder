import { Test } from '@nestjs/testing';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { ProfileVisibilityService } from './profile-visibility.service.js';
import { UsersRepository } from './users.repository.js';

const row = {
  id: 'user-1',
  username: 'ada',
  showSummarySection: true,
  showPracticeHistorySection: true,
  showFavoritesSection: true,
};

const repository = {
  findProfileVisibility: vi.fn(),
  findProfileVisibilityByUsername: vi.fn(),
  updateProfileVisibility: vi.fn(),
};
const webRevalidation = { revalidate: vi.fn() };

describe('ProfileVisibilityService', () => {
  let service: ProfileVisibilityService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileVisibilityService,
        { provide: UsersRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: webRevalidation },
      ],
    }).compile();
    service = moduleRef.get(ProfileVisibilityService);
  });

  describe('getVisibility', () => {
    it('returns the flags of every section', async () => {
      repository.findProfileVisibility.mockResolvedValue({
        ...row,
        showFavoritesSection: false,
      });

      await expect(service.getVisibility('user-1')).resolves.toEqual({
        summary: true,
        practiceHistory: true,
        favorites: false,
      });
    });

    it('refuses a session whose User is gone', async () => {
      repository.findProfileVisibility.mockResolvedValue(undefined);

      await expect(service.getVisibility('user-1')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('updateVisibility', () => {
    it('saves only the flags given and refreshes the Profile tags', async () => {
      repository.updateProfileVisibility.mockResolvedValue({
        ...row,
        showPracticeHistorySection: false,
      });

      const flags = await service.updateVisibility('user-1', {
        practiceHistory: false,
      });

      expect(repository.updateProfileVisibility).toHaveBeenCalledWith(
        'user-1',
        { showPracticeHistorySection: false },
      );
      expect(flags).toEqual({
        summary: true,
        practiceHistory: false,
        favorites: true,
      });
      expect(webRevalidation.revalidate).toHaveBeenCalledWith([
        cacheTags.userProfile('ada'),
        cacheTags.userFavorites('ada'),
      ]);
    });

    it('writes nothing for an empty change and returns the stored flags', async () => {
      repository.findProfileVisibility.mockResolvedValue(row);

      const flags = await service.updateVisibility('user-1', {});

      expect(repository.updateProfileVisibility).not.toHaveBeenCalled();
      expect(webRevalidation.revalidate).not.toHaveBeenCalled();
      expect(flags).toEqual({
        summary: true,
        practiceHistory: true,
        favorites: true,
      });
    });

    it('keeps the save when the revalidation cannot be enqueued', async () => {
      repository.updateProfileVisibility.mockResolvedValue(row);
      webRevalidation.revalidate.mockRejectedValue(new Error('Queue is down'));

      await expect(
        service.updateVisibility('user-1', { summary: true }),
      ).resolves.toMatchObject({ summary: true });
    });

    it('revalidates nothing for a User without a username', async () => {
      repository.updateProfileVisibility.mockResolvedValue({
        ...row,
        username: null,
      });

      await service.updateVisibility('user-1', { favorites: false });

      expect(webRevalidation.revalidate).not.toHaveBeenCalled();
    });

    it('refuses a change for a User who is gone', async () => {
      repository.updateProfileVisibility.mockResolvedValue(undefined);

      await expect(
        service.updateVisibility('user-1', { summary: false }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('assertSectionVisible', () => {
    it('lets a visitor read a shown section and returns the User ID', async () => {
      repository.findProfileVisibilityByUsername.mockResolvedValue(row);

      await expect(
        service.assertSectionVisible('Ada', 'summary', undefined),
      ).resolves.toBe('user-1');
      expect(repository.findProfileVisibilityByUsername).toHaveBeenCalledWith(
        'ada',
      );
    });

    it('refuses a visitor a hidden section as NOT_FOUND', async () => {
      repository.findProfileVisibilityByUsername.mockResolvedValue({
        ...row,
        showFavoritesSection: false,
      });

      await expect(
        service.assertSectionVisible('ada', 'favorites', 'someone-else'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lets the owner read a hidden section', async () => {
      repository.findProfileVisibilityByUsername.mockResolvedValue({
        ...row,
        showFavoritesSection: false,
      });

      await expect(
        service.assertSectionVisible('ada', 'favorites', 'user-1'),
      ).resolves.toBe('user-1');
    });

    it('answers NOT_FOUND for an unknown username', async () => {
      repository.findProfileVisibilityByUsername.mockResolvedValue(undefined);

      await expect(
        service.assertSectionVisible('nobody', 'summary', 'user-1'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
