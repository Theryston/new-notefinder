import type { Job } from 'bullmq';
import {
  REFRESH_SCORED_TRACKS_JOB,
  REFRESH_TRENDING_SCORE_JOB,
} from './track-trending.job.js';
import { TrackTrendingProcessor } from './track-trending.processor.js';
import type { TrackTrendingService } from './track-trending.service.js';

const trending = { refresh: vi.fn(), refreshScored: vi.fn() };

const processor = () =>
  new TrackTrendingProcessor(trending as unknown as TrackTrendingService);

const job = (name: string, data: unknown) => ({ name, data }) as Job<unknown>;

describe('TrackTrendingProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the score of the Track in the job', async () => {
    await processor().process(
      job(REFRESH_TRENDING_SCORE_JOB, { trackId: 'track-1' }),
    );

    expect(trending.refresh).toHaveBeenCalledWith('track-1');
    expect(trending.refreshScored).not.toHaveBeenCalled();
  });

  it('refreshes every scored Track on the daily job', async () => {
    await processor().process(job(REFRESH_SCORED_TRACKS_JOB, {}));

    expect(trending.refreshScored).toHaveBeenCalledTimes(1);
    expect(trending.refresh).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a payload retrying cannot fix',
      REFRESH_TRENDING_SCORE_JOB,
      { trackId: '' },
    ],
    ['a job it does not know', 'something-else', { trackId: 'track-1' }],
  ])('gives up on %s', async (_name, name, data) => {
    await expect(processor().process(job(name, data))).rejects.toThrow(
      'Invalid job',
    );

    expect(trending.refresh).not.toHaveBeenCalled();
  });
});
