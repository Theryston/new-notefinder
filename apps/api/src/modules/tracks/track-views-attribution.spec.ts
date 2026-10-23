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
      attachUser: vi.fn(),
      attachVisitor: vi.fn(),
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
        visitorId: 'visitor-1',
      });

      expect(views.create).toHaveBeenCalledWith('track-1', null, undefined, {
        clickId: 'click-1',
        visitorId: 'visitor-1',
      });
    } finally {
      await moduleRef.close();
    }
  });

  it('creates a separate view when a later click references the previous view', async () => {
    const views = {
      findView: vi.fn().mockResolvedValue({
        id: 'view-1',
        userId: null,
        clickId: 'click-1',
        visitorId: 'visitor-1',
      }),
      create: vi.fn().mockResolvedValue('view-2'),
      attachUser: vi.fn(),
      attachVisitor: vi.fn(),
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
        visitorId: 'visitor-1',
      });

      expect(views.create).toHaveBeenCalledWith('track-1', null, undefined, {
        clickId: 'click-2',
        visitorId: 'visitor-1',
      });
      expect(views.attachUser).not.toHaveBeenCalled();
      expect(views.attachVisitor).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
    }
  });

  it('reuses the same click view without changing its attribution', async () => {
    const views = {
      findView: vi.fn().mockResolvedValue({
        id: 'view-1',
        userId: null,
        clickId: 'click-1',
        visitorId: 'visitor-1',
      }),
      create: vi.fn(),
      attachUser: vi.fn(),
      attachVisitor: vi.fn(),
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
      await expect(
        service.record({
          trackId: 'track-1',
          userId: undefined,
          viewId: 'view-1',
          clickId: 'click-1',
          visitorId: 'visitor-1',
        }),
      ).resolves.toEqual({ viewId: 'view-1', created: false });
      expect(views.create).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
    }
  });

  it('backfills a missing visitor id without replacing click attribution', async () => {
    const views = {
      findView: vi.fn().mockResolvedValue({
        id: 'view-1',
        userId: null,
        clickId: 'click-1',
        visitorId: null,
      }),
      create: vi.fn(),
      attachUser: vi.fn(),
      attachVisitor: vi.fn(),
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
      await moduleRef.get(TrackViewsService).record({
        trackId: 'track-1',
        userId: undefined,
        viewId: 'view-1',
        clickId: 'click-1',
        visitorId: 'visitor-1',
      });
      expect(views.attachVisitor).toHaveBeenCalledWith('view-1', 'visitor-1');
      expect(views.create).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
    }
  });
});
