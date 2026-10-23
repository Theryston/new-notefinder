import { describe, expect, it, vi } from 'vitest';
import { ProfileVisibilityService } from './profile-visibility.service.js';

describe('ProfileVisibilityService batch social read', () => {
  it('returns current usernames and section flags for candidate IDs', async () => {
    const repository = {
      findManyByIds: vi.fn().mockResolvedValue([
        {
          id: 'person',
          username: 'person_name',
          showSummarySection: true,
          showPracticeHistorySection: false,
          showFavoritesSection: true,
        },
      ]),
    };
    const service = new ProfileVisibilityService(
      repository as never,
      {} as never,
    );

    await expect(
      service.getShownSectionsByUserIds(['person']),
    ).resolves.toEqual(
      new Map([
        [
          'person',
          {
            username: 'person_name',
            shown: { summary: true, practiceHistory: false, favorites: true },
          },
        ],
      ]),
    );
    expect(repository.findManyByIds).toHaveBeenCalledWith(['person']);
  });
});
