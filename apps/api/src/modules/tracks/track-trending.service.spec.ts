import { Test } from '@nestjs/testing';
import { cacheTags } from '@vozzify/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackTrendingService } from './track-trending.service.js';
import { TrackViewRepository } from './track-view.repository.js';
import { TracksRepository } from './tracks.repository.js';

const views = {
  countTrackViews: vi.fn(),
  platformAverages: vi.fn(),
};
const tracks = { setTrendingScore: vi.fn(), findScoredTracks: vi.fn() };
const revalidation = { revalidate: vi.fn() };

const NOW = new Date('2026-10-14T15:42:00.000Z');
const QUIET = { hour: 0, day: 0, week: 0, month: 0, allTime: 0 };
const BUSY = { hour: 2, day: 5, week: 20, month: 50, allTime: 100 };

describe('TrackTrendingService', () => {
  let service: TrackTrendingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    views.platformAverages.mockResolvedValue({ hour: 1, day: 3 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackTrendingService,
        { provide: TrackViewRepository, useValue: views },
        { provide: TracksRepository, useValue: tracks },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(TrackTrendingService);
  });

  describe('refresh', () => {
    it('stores the score of the views it reads for the windows ending now', async () => {
      views.countTrackViews.mockResolvedValue(BUSY);

      await service.refresh('track-1', NOW);

      expect(views.countTrackViews).toHaveBeenCalledWith(
        'track-1',
        expect.objectContaining({ hour: new Date('2026-10-14T15:00:00.000Z') }),
      );
      expect(tracks.setTrendingScore).toHaveBeenCalledWith('track-1', 453);
    });

    it('revalidates only the Track, not the sitemap', async () => {
      views.countTrackViews.mockResolvedValue(QUIET);

      await service.refresh('track-1', NOW);

      expect(revalidation.revalidate).toHaveBeenCalledWith([
        cacheTags.track('track-1'),
      ]);
    });

    it('revalidates the sitemap too when the refreshed score changed', async () => {
      views.countTrackViews.mockResolvedValue(BUSY);
      tracks.setTrendingScore.mockResolvedValueOnce(true);

      await service.refresh('track-1', NOW);

      expect(revalidation.revalidate).toHaveBeenNthCalledWith(1, [
        cacheTags.track('track-1'),
      ]);
      expect(revalidation.revalidate).toHaveBeenNthCalledWith(2, [
        cacheTags.sitemap,
      ]);
    });

    it('leaves the sitemap alone when the refreshed score did not change', async () => {
      views.countTrackViews.mockResolvedValue(BUSY);
      tracks.setTrendingScore.mockResolvedValueOnce(false);

      await service.refresh('track-1', NOW);

      expect(revalidation.revalidate).toHaveBeenCalledTimes(1);
      expect(revalidation.revalidate).not.toHaveBeenCalledWith([
        cacheTags.sitemap,
      ]);
    });
  });

  describe('refreshScored', () => {
    it('recomputes every scored Track against one read of the platform averages', async () => {
      tracks.findScoredTracks.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      views.countTrackViews.mockImplementation(async (trackId: string) =>
        trackId === 'a' ? BUSY : QUIET,
      );

      await expect(service.refreshScored(NOW)).resolves.toBe(2);

      expect(views.platformAverages).toHaveBeenCalledTimes(1);
      expect(tracks.setTrendingScore).toHaveBeenCalledWith('a', 453);
      // Its views stopped: the windows rolled, so the score falls to 0.
      expect(tracks.setTrendingScore).toHaveBeenCalledWith('b', 0);
    });

    it('revalidates the sitemap once, whose order changed', async () => {
      tracks.findScoredTracks.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      views.countTrackViews.mockResolvedValue(QUIET);

      await service.refreshScored(NOW);

      expect(revalidation.revalidate).toHaveBeenCalledTimes(1);
      expect(revalidation.revalidate).toHaveBeenCalledWith([cacheTags.sitemap]);
    });

    it('does nothing when no Track is scored', async () => {
      tracks.findScoredTracks.mockResolvedValue([]);

      await expect(service.refreshScored(NOW)).resolves.toBe(0);

      expect(tracks.setTrendingScore).not.toHaveBeenCalled();
      expect(revalidation.revalidate).not.toHaveBeenCalled();
    });
  });
});
