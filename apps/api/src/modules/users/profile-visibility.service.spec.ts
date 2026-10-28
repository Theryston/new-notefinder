import { Test } from '@nestjs/testing';
import { cacheTags } from '@vozzify/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { ProfileVisibilityRepository } from './profile-visibility.repository.js';
import { ProfileVisibilityService } from './profile-visibility.service.js';

const row = {
  id: 'user-1',
  username: 'ada',
  showSummarySection: true,
  showPracticeHistorySection: true,
  showFavoritesSection: true,
};

const repository = {
  findById: vi.fn(),
  findByUsername: vi.fn(),
  update: vi.fn(),
};
const webRevalidation = { revalidate: vi.fn() };

describe('ProfileVisibilityService', () => {
  let service: ProfileVisibilityService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileVisibilityService,
        { provide: ProfileVisibilityRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: webRevalidation },
      ],
    }).compile();
    service = moduleRef.get(ProfileVisibilityService);
  });

  describe('getVisibility', () => {
    it('returns the flags of every section', async () => {
      repository.findById.mockResolvedValue({
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
      repository.findById.mockResolvedValue(undefined);

      await expect(service.getVisibility('user-1')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('updateVisibility', () => {
    it('saves only the flags given and refreshes the Profile tags', async () => {
      repository.update.mockResolvedValue({
        ...row,
        showPracticeHistorySection: false,
      });

      const flags = await service.updateVisibility('user-1', {
        practiceHistory: false,
      });

      expect(repository.update).toHaveBeenCalledWith('user-1', {
        showPracticeHistorySection: false,
      });
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
      repository.findById.mockResolvedValue(row);

      const flags = await service.updateVisibility('user-1', {});

      expect(repository.update).not.toHaveBeenCalled();
      expect(webRevalidation.revalidate).not.toHaveBeenCalled();
      expect(flags).toEqual({
        summary: true,
        practiceHistory: true,
        favorites: true,
      });
    });

    it('keeps the save when the revalidation cannot be enqueued', async () => {
      repository.update.mockResolvedValue(row);
      webRevalidation.revalidate.mockRejectedValue(new Error('Queue is down'));

      await expect(
        service.updateVisibility('user-1', { summary: true }),
      ).resolves.toMatchObject({ summary: true });
    });

    it('revalidates nothing for a User without a username', async () => {
      repository.update.mockResolvedValue({ ...row, username: null });

      await service.updateVisibility('user-1', { favorites: false });

      expect(webRevalidation.revalidate).not.toHaveBeenCalled();
    });

    it('refuses a change for a User who is gone', async () => {
      repository.update.mockResolvedValue(undefined);

      await expect(
        service.updateVisibility('user-1', { summary: false }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('getShownSections', () => {
    it('answers the stored flags for a visitor', async () => {
      repository.findByUsername.mockResolvedValue({
        ...row,
        showFavoritesSection: false,
      });

      await expect(service.getShownSections('Ada')).resolves.toEqual({
        summary: true,
        practiceHistory: true,
        favorites: false,
      });
      expect(repository.findByUsername).toHaveBeenCalledWith('ada');
    });

    it('answers NOT_FOUND for an unknown username', async () => {
      repository.findByUsername.mockResolvedValue(undefined);

      await expect(service.getShownSections('nobody')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('readSection', () => {
    it('lets a visitor read a shown section, with the User ID and the shown sections', async () => {
      repository.findByUsername.mockResolvedValue(row);

      await expect(
        service.readSection('Ada', 'summary', undefined),
      ).resolves.toEqual({
        userId: 'user-1',
        shown: { summary: true, practiceHistory: true, favorites: true },
      });
      expect(repository.findByUsername).toHaveBeenCalledWith('ada');
    });

    it('refuses a visitor a hidden section as NOT_FOUND', async () => {
      repository.findByUsername.mockResolvedValue({
        ...row,
        showFavoritesSection: false,
      });

      await expect(
        service.readSection('ada', 'favorites', 'someone-else'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lets the owner read a hidden section, and shows the owner every section', async () => {
      repository.findByUsername.mockResolvedValue({
        ...row,
        showFavoritesSection: false,
      });

      await expect(
        service.readSection('ada', 'favorites', 'user-1'),
      ).resolves.toEqual({
        userId: 'user-1',
        shown: { summary: true, practiceHistory: true, favorites: true },
      });
    });

    it('answers NOT_FOUND for an unknown username', async () => {
      repository.findByUsername.mockResolvedValue(undefined);

      await expect(
        service.readSection('nobody', 'summary', 'user-1'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
