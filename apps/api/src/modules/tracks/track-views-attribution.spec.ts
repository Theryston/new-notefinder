import { Test } from '@nestjs/testing';
import { TrackTrendingQueueService } from './track-trending-queue.service.js';
import { TrackViewRepository } from './track-view.repository.js';
import { TrackViewsService } from './track-views.service.js';
import { TracksService } from './tracks.service.js';

describe('TrackViewsService click attribution', () => {
  it('stores a click id on a new view', async () => {
    const views = {
      findView: vi.fn(),
      create: vi.fn().mockResolvedValue('view-1'),
      attachClick: vi.fn(),
      attachUser: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackViewsService,
        { provide: TracksService, useValue: { assertTrackExists: vi.fn() } },
        { provide: TrackViewRepository, useValue: views },
        { provide: TrackTrendingQueueService, useValue: { schedule: vi.fn() } },
      ],
    }).compile();

    try {
      const service = moduleRef.get(TrackViewsService);
      await service.record({
        trackId: 'track-1',
        userId: undefined,
        viewId: undefined,
        clickId: 'click-1',
      });

      expect(views.create).toHaveBeenCalledWith(
        'track-1',
        null,
        undefined,
        'click-1',
      );
    } finally {
      await moduleRef.close();
    }
  });

  it('updates the click id when a same-session view already exists', async () => {
    const views = {
      findView: vi.fn().mockResolvedValue({ id: 'view-1', userId: null }),
      create: vi.fn(),
      attachClick: vi.fn(),
      attachUser: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackViewsService,
        { provide: TracksService, useValue: { assertTrackExists: vi.fn() } },
        { provide: TrackViewRepository, useValue: views },
        { provide: TrackTrendingQueueService, useValue: { schedule: vi.fn() } },
      ],
    }).compile();

    try {
      const service = moduleRef.get(TrackViewsService);
      await service.record({
        trackId: 'track-1',
        userId: undefined,
        viewId: 'view-1',
        clickId: 'click-2',
      });

      expect(views.attachClick).toHaveBeenCalledWith('view-1', 'click-2');
      expect(views.create).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
    }
  });
});
