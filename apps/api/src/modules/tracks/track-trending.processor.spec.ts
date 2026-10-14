import type { Job } from 'bullmq';
import { TrackTrendingProcessor } from './track-trending.processor.js';
import type { TrackTrendingService } from './track-trending.service.js';

const trending = { refresh: vi.fn() };

const processor = () =>
  new TrackTrendingProcessor(trending as unknown as TrackTrendingService);

const job = (data: unknown) => ({ data }) as Job<unknown>;

describe('TrackTrendingProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the score of the Track in the job', async () => {
    await processor().process(job({ trackId: 'track-1' }));

    expect(trending.refresh).toHaveBeenCalledWith('track-1');
  });

  it('gives up on a payload retrying cannot fix', async () => {
    await expect(processor().process(job({ trackId: '' }))).rejects.toThrow(
      'Invalid job payload',
    );

    expect(trending.refresh).not.toHaveBeenCalled();
  });
});
