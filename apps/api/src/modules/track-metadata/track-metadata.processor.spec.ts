import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { TrackMetadataProcessor } from './track-metadata.processor.js';
import { TrackMetadataService } from './track-metadata.service.js';

// The queue's entry point: a payload that breaks its schema never succeeds, and
// a valid job runs once per attempt, knowing whether BullMQ gives up on it.

const metadata = { run: vi.fn() };

/** A job as BullMQ hands it to the processor: its payload and its attempts. */
const jobOf = (
  data: unknown,
  attemptsMade: number,
  attempts: number,
): Job<unknown> =>
  ({
    data,
    attemptsMade,
    opts: { attempts },
  }) as unknown as Job<unknown>;

describe('TrackMetadataProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metadata.run.mockResolvedValue(undefined);
  });

  it('runs the import of the job, marking the last attempt as final', async () => {
    const processor = new TrackMetadataProcessor(
      metadata as unknown as TrackMetadataService,
    );

    await processor.process(jobOf({ trackId: 'track-1' }, 4, 5));

    expect(metadata.run).toHaveBeenCalledWith({ trackId: 'track-1' }, true);
  });

  it('marks an attempt that BullMQ will retry as not final', async () => {
    const processor = new TrackMetadataProcessor(
      metadata as unknown as TrackMetadataService,
    );

    await processor.process(jobOf({ trackId: 'track-1' }, 0, 5));

    expect(metadata.run).toHaveBeenCalledWith({ trackId: 'track-1' }, false);
  });

  it('never retries a job whose payload breaks its schema', async () => {
    const processor = new TrackMetadataProcessor(
      metadata as unknown as TrackMetadataService,
    );

    await expect(
      processor.process(jobOf({ trackId: '' }, 0, 5)),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(metadata.run).not.toHaveBeenCalled();
  });
});
