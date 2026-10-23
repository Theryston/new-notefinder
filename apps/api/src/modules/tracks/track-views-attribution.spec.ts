import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, vi } from 'vitest';
import { TrackTrendingQueueService } from './track-trending-queue.service.js';
import { TrackViewRepository } from './track-view.repository.js';
import { TrackViewsService } from './track-views.service.js';
import { TracksService } from './tracks.service.js';

describe('TrackViewsService click attribution', () => {
  const views = {
    findView: vi.fn(),
    create: vi.fn(),
    attachUser: vi.fn(),
    attachVisitor: vi.fn(),
  };
  let service: TrackViewsService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    views.create.mockResolvedValue('view-created');
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackViewsService,
        { provide: TracksService, useValue: { assertTrackExists: vi.fn() } },
        { provide: TrackViewRepository, useValue: views },
        { provide: TrackTrendingQueueService, useValue: { schedule: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(TrackViewsService);
  });

  afterEach(async () => moduleRef.close());

  it('stores a click id on a new view', async () => {
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
  });

  it('creates a separate view when a later click references the previous view', async () => {
    views.findView.mockResolvedValue({
      id: 'view-1',
      userId: null,
      clickId: 'click-1',
      visitorId: 'visitor-1',
    });

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
  });

  it('reuses the same click view without changing its attribution', async () => {
    views.findView.mockResolvedValue({
      id: 'view-1',
      userId: null,
      clickId: 'click-1',
      visitorId: 'visitor-1',
    });

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
  });

  it('backfills a missing visitor id without replacing click attribution', async () => {
    views.findView.mockResolvedValue({
      id: 'view-1',
      userId: null,
      clickId: 'click-1',
      visitorId: null,
    });

    await service.record({
      trackId: 'track-1',
      userId: undefined,
      viewId: 'view-1',
      clickId: 'click-1',
      visitorId: 'visitor-1',
    });
    expect(views.attachVisitor).toHaveBeenCalledWith('view-1', 'visitor-1');
    expect(views.create).not.toHaveBeenCalled();
  });
});
