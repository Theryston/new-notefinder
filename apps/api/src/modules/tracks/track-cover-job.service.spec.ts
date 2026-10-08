import { Test, type TestingModule } from '@nestjs/testing';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackCoverService } from './track-cover.service.js';
import { TrackCoverJob } from './track-cover-job.service.js';

const covers = { storeCover: vi.fn() };
const revalidation = { revalidate: vi.fn() };

describe('TrackCoverJob', () => {
  let job: TrackCoverJob;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackCoverJob,
        { provide: TrackCoverService, useValue: covers },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    job = moduleRef.get(TrackCoverJob);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('refreshes the Track pages once a cover is stored', async () => {
    covers.storeCover.mockResolvedValue(true);

    await job.run('track-1', true);

    expect(covers.storeCover).toHaveBeenCalledWith('track-1');
    expect(revalidation.revalidate).toHaveBeenCalledWith([
      'track:track-1',
      'tracks',
    ]);
  });

  it('refreshes the pages after a pass that stored nothing too, so a replay refreshes', async () => {
    covers.storeCover.mockResolvedValue(false);

    await job.run('track-1', true);

    expect(revalidation.revalidate).toHaveBeenCalledWith([
      'track:track-1',
      'tracks',
    ]);
  });

  it('lets BullMQ retry when the refresh fails before its last attempt', async () => {
    covers.storeCover.mockResolvedValue(true);
    const error = new Error('web is down');
    revalidation.revalidate.mockRejectedValueOnce(error);

    await expect(job.run('track-1', false)).rejects.toBe(error);
  });

  it('lets BullMQ retry a failed download before its last attempt', async () => {
    const error = new Error('Image download failed with HTTP 503');
    covers.storeCover.mockRejectedValue(error);

    await expect(job.run('track-1', false)).rejects.toBe(error);
  });

  it('only logs a failure on its last attempt, leaving the placeholder', async () => {
    covers.storeCover.mockRejectedValue(new Error('storage is down'));

    await expect(job.run('track-1', true)).resolves.toBe(undefined);

    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
});
