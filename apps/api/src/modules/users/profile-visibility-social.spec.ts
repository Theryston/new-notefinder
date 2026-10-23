import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { ProfileVisibilityRepository } from './profile-visibility.repository.js';
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
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileVisibilityService,
        { provide: ProfileVisibilityRepository, useValue: repository },
        { provide: WebRevalidationService, useValue: {} },
      ],
    }).compile();
    const service = moduleRef.get(ProfileVisibilityService);

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
    await moduleRef.close();
  });
});
