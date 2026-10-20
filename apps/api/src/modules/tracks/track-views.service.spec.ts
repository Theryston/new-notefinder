import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { TrackTrendingQueueService } from './track-trending-queue.service.js';
import { TrackViewRepository } from './track-view.repository.js';
import { TrackViewsService } from './track-views.service.js';
import { TracksService } from './tracks.service.js';

const tracks = { assertTrackExists: vi.fn() };
const views = {
  findView: vi.fn(),
  create: vi.fn(),
  attachUser: vi.fn(),
};
const trending = { schedule: vi.fn() };

describe('TrackViewsService', () => {
  let service: TrackViewsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    views.create.mockResolvedValue('view-new');
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackViewsService,
        { provide: TracksService, useValue: tracks },
        { provide: TrackViewRepository, useValue: views },
        { provide: TrackTrendingQueueService, useValue: trending },
      ],
    }).compile();
    service = moduleRef.get(TrackViewsService);
  });

  it('records a view for a visitor and schedules the trending score', async () => {
    await expect(
      service.record({
        trackId: 'track-1',
        userId: undefined,
        viewId: undefined,
      }),
    ).resolves.toEqual({ viewId: 'view-new', created: true });

    expect(views.create).toHaveBeenCalledWith('track-1', null, undefined);
    expect(trending.schedule).toHaveBeenCalledWith('track-1');
  });

  it('records the locale the page was displayed in with the view', async () => {
    await service.record({
      trackId: 'track-1',
      userId: undefined,
      viewId: undefined,
      locale: 'pt-BR',
    });

    expect(views.create).toHaveBeenCalledWith('track-1', null, 'pt-BR');
  });

  it('records no locale when the client sent none', async () => {
    await service.record({
      trackId: 'track-1',
      userId: undefined,
      viewId: undefined,
      locale: undefined,
    });

    expect(views.create).toHaveBeenCalledWith('track-1', null, undefined);
  });

  it('keeps the stored locale when it attaches the User to a view', async () => {
    views.findView.mockResolvedValue({ id: 'view-1', userId: null });

    await service.record({
      trackId: 'track-1',
      userId: 'user-1',
      viewId: 'view-1',
      locale: 'pt-BR',
    });

    expect(views.attachUser).toHaveBeenCalledWith('view-1', 'user-1');
    expect(views.create).not.toHaveBeenCalled();
  });

  it('records the signed-in User with the view', async () => {
    await service.record({
      trackId: 'track-1',
      userId: 'user-1',
      viewId: undefined,
    });

    expect(views.create).toHaveBeenCalledWith('track-1', 'user-1', undefined);
  });

  it('attaches the User to the stored view instead of recording another', async () => {
    views.findView.mockResolvedValue({ id: 'view-1', userId: null });

    await expect(
      service.record({
        trackId: 'track-1',
        userId: 'user-1',
        viewId: 'view-1',
      }),
    ).resolves.toEqual({ viewId: 'view-1', created: false });

    expect(views.findView).toHaveBeenCalledWith('view-1', 'track-1');
    expect(views.attachUser).toHaveBeenCalledWith('view-1', 'user-1');
    expect(views.create).not.toHaveBeenCalled();
    expect(trending.schedule).not.toHaveBeenCalled();
  });

  it('leaves a view that already has a User as it is', async () => {
    views.findView.mockResolvedValue({ id: 'view-1', userId: 'user-2' });

    await service.record({
      trackId: 'track-1',
      userId: 'user-1',
      viewId: 'view-1',
    });

    expect(views.attachUser).not.toHaveBeenCalled();
  });

  it('attaches nobody when the visitor is still signed out', async () => {
    views.findView.mockResolvedValue({ id: 'view-1', userId: null });

    await expect(
      service.record({
        trackId: 'track-1',
        userId: undefined,
        viewId: 'view-1',
      }),
    ).resolves.toEqual({ viewId: 'view-1', created: false });

    expect(views.attachUser).not.toHaveBeenCalled();
  });

  it('treats an ID that names no view of the Track as no ID', async () => {
    views.findView.mockResolvedValue(undefined);

    await expect(
      service.record({
        trackId: 'track-1',
        userId: 'user-1',
        viewId: 'stale',
      }),
    ).resolves.toEqual({ viewId: 'view-new', created: true });

    expect(views.create).toHaveBeenCalledWith('track-1', 'user-1', undefined);
  });

  it('records nothing for an unknown Track', async () => {
    tracks.assertTrackExists.mockRejectedValue(
      new AppException('NOT_FOUND', 'Track not found'),
    );

    await expect(
      service.record({ trackId: 'nope', userId: undefined, viewId: undefined }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(views.create).not.toHaveBeenCalled();
  });
});
