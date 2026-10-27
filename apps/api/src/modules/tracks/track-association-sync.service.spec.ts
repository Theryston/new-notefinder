import { TrackAssociationService } from './track-association.service.js';
import { TrackAssociationEventRepository } from './track-association-event.repository.js';
import { TrackAssociationSyncRepository } from './track-association-sync.repository.js';
import { TrackAssociationSyncService } from './track-association-sync.service.js';

describe('TrackAssociationSyncService', () => {
  const tracks = { findPage: vi.fn() };
  const events = {
    enqueueSynchronizationPage: vi.fn(),
    countPendingForTracks: vi.fn(),
    countPending: vi.fn(),
  };
  const delivery = { dispatchPending: vi.fn() };
  let service: TrackAssociationSyncService;

  beforeEach(() => {
    vi.resetAllMocks();
    tracks.findPage.mockResolvedValue([]);
    events.enqueueSynchronizationPage.mockResolvedValue(undefined);
    events.countPendingForTracks.mockResolvedValue([{ count: 0 }]);
    events.countPending.mockResolvedValue([{ count: 0 }]);
    service = new TrackAssociationSyncService(
      tracks as unknown as TrackAssociationSyncRepository,
      events as unknown as TrackAssociationEventRepository,
      delivery as unknown as TrackAssociationService,
    );
  });

  it('walks a stable keyset and enqueues every row regardless of Processing state', async () => {
    const page = Array.from({ length: 250 }, (_, index) => ({
      id: `track-${String(index).padStart(3, '0')}`,
      recordingMbid: `mbid-${index}`,
    }));
    tracks.findPage
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([{ id: 'track-z', recordingMbid: 'mbid-z' }])
      .mockResolvedValueOnce([]);

    await service.synchronize();

    expect(
      tracks.findPage.mock.calls.map(([after, limit]) => [after, limit]),
    ).toEqual([
      [undefined, 250],
      ['track-249', 250],
      ['track-z', 250],
    ]);
    expect(events.enqueueSynchronizationPage).toHaveBeenCalledTimes(2);
    expect(delivery.dispatchPending).toHaveBeenCalledTimes(3);
  });

  it('reruns from the beginning to restore previously lost projection state', async () => {
    tracks.findPage
      .mockResolvedValueOnce([{ id: 'track-a', recordingMbid: 'mbid-a' }])
      .mockResolvedValueOnce([]);
    await service.synchronize();
    tracks.findPage.mockClear();
    tracks.findPage
      .mockResolvedValueOnce([{ id: 'track-a', recordingMbid: 'mbid-a' }])
      .mockResolvedValueOnce([]);

    await service.synchronize();

    expect(tracks.findPage).toHaveBeenNthCalledWith(1, undefined, 250);
    expect(events.enqueueSynchronizationPage).toHaveBeenCalledTimes(2);
  });

  it('restarts from the first page after an interrupted delivery', async () => {
    const page = [{ id: 'track-a', recordingMbid: 'mbid-a' }];
    tracks.findPage
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([]);
    delivery.dispatchPending
      .mockRejectedValueOnce(new Error('database connection lost'))
      .mockResolvedValue(undefined);

    await expect(service.synchronize()).rejects.toThrow(
      'database connection lost',
    );
    await service.synchronize();

    expect(tracks.findPage).toHaveBeenNthCalledWith(1, undefined, 250);
    expect(tracks.findPage).toHaveBeenNthCalledWith(2, undefined, 250);
    expect(events.enqueueSynchronizationPage).toHaveBeenCalledTimes(2);
  });
});
