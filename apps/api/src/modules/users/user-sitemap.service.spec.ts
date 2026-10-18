import { Test } from '@nestjs/testing';
import { describeSitemapListing } from '../../../test/utils/sitemap-listing-spec.js';
import { UserSitemapRepository } from './user-sitemap.repository.js';
import { UserSitemapService } from './user-sitemap.service.js';

describeSitemapListing(
  'UserSitemapService',
  UserSitemapService,
  UserSitemapRepository,
);

describe('UserSitemapService (Usernames)', () => {
  it('carries each listed User its Username, for the Profile URL', async () => {
    const sitemap = { listAfter: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserSitemapService,
        { provide: UserSitemapRepository, useValue: sitemap },
      ],
    }).compile();
    sitemap.listAfter.mockResolvedValue([
      {
        id: 'user-1',
        username: 'grace',
        updatedAt: new Date('2026-10-14T12:00:00.000Z'),
      },
    ]);

    const page = await moduleRef.get(UserSitemapService).list({ limit: 5 });

    expect(page).toEqual({
      items: [
        {
          id: 'user-1',
          username: 'grace',
          updatedAt: '2026-10-14T12:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
  });
});
