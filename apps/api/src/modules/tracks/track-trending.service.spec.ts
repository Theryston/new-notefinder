import { Test } from '@nestjs/testing';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackTrendingService } from './track-trending.service.js';
import { TrackViewRepository } from './track-view.repository.js';

const views = {
  countTrackViews: vi.fn(),
  platformAverages: vi.fn(),
  setTrendingScore: vi.fn(),
};
const revalidation = { revalidate: vi.fn() };

describe('TrackTrendingService', () => {
  let service: TrackTrendingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackTrendingService,
        { provide: TrackViewRepository, useValue: views },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(TrackTrendingService);
  });

  it('stores the score of the views it reads for the windows ending now', async () => {
    views.countTrackViews.mockResolvedValue({
      hour: 2,
      day: 5,
      week: 20,
      month: 50,
      allTime: 100,
    });
    views.platformAverages.mockResolvedValue({ hour: 1, day: 3 });

    await service.refresh('track-1', new Date('2026-10-14T15:42:00.000Z'));

    expect(views.countTrackViews).toHaveBeenCalledWith(
      'track-1',
      expect.objectContaining({ hour: new Date('2026-10-14T15:00:00.000Z') }),
    );
    expect(views.setTrendingScore).toHaveBeenCalledWith('track-1', 453);
  });

  it('asks the web to revalidate the Track and the sitemap', async () => {
    views.countTrackViews.mockResolvedValue({
      hour: 0,
      day: 0,
      week: 0,
      month: 0,
      allTime: 0,
    });
    views.platformAverages.mockResolvedValue({ hour: 0, day: 0 });

    await service.refresh('track-1');

    expect(revalidation.revalidate).toHaveBeenCalledWith([
      cacheTags.track('track-1'),
      cacheTags.sitemap,
    ]);
  });
});
