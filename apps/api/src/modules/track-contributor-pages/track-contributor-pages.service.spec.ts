import { Test } from '@nestjs/testing';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackContributorPagesRepository } from './track-contributor-pages.repository.js';
import { TrackContributorPagesService } from './track-contributor-pages.service.js';

const pages = { findTrackIdsOf: vi.fn() };
const revalidation = { revalidate: vi.fn() };

describe('TrackContributorPagesService', () => {
  let service: TrackContributorPagesService;

  beforeEach(async () => {
    vi.clearAllMocks();
    revalidation.revalidate.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackContributorPagesService,
        { provide: TrackContributorPagesRepository, useValue: pages },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(TrackContributorPagesService);
  });

  it('revalidates the page of every Track the User contributed to', async () => {
    pages.findTrackIdsOf.mockResolvedValue(['track-1', 'track-2']);

    await service.revalidateTracksOf('user-1');

    expect(pages.findTrackIdsOf).toHaveBeenCalledWith('user-1');
    expect(revalidation.revalidate).toHaveBeenCalledWith([
      'track:track-1',
      'track:track-2',
    ]);
  });

  it('does nothing for a User without Contributions', async () => {
    pages.findTrackIdsOf.mockResolvedValue([]);

    await service.revalidateTracksOf('user-1');

    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });

  it('swallows a failure, since the change is already saved', async () => {
    pages.findTrackIdsOf.mockResolvedValue(['track-1']);
    revalidation.revalidate.mockRejectedValue(new Error('queue down'));

    await expect(service.revalidateTracksOf('user-1')).resolves.toBeUndefined();
  });
});
