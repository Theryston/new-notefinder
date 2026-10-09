import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import { TRACK_METADATA_QUEUE } from '../../queue/track-metadata.job.js';
import { TrackMetadataQueueService } from './track-metadata-queue.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';

// Queuing the import: keyed by the newest Processing, so each Processing gets
// its own job, and nothing is queued for a Track without a Processing.

const queue = { add: vi.fn() };
const processings = { findLatestProcessing: vi.fn() };

describe('TrackMetadataQueueService', () => {
  let service: TrackMetadataQueueService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    queue.add.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackMetadataQueueService,
        { provide: getQueueToken(TRACK_METADATA_QUEUE), useValue: queue },
        { provide: TrackProcessingRepository, useValue: processings },
      ],
    }).compile();
    service = moduleRef.get(TrackMetadataQueueService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('queues the import under the newest Processing, so every Processing gets its own job', async () => {
    processings.findLatestProcessing.mockResolvedValue({
      id: 'processing-2',
      status: 'QUEUED',
    });

    await service.enqueueImport('track-1');

    expect(processings.findLatestProcessing).toHaveBeenCalledWith('track-1');
    expect(queue.add).toHaveBeenCalledWith(
      'import-metadata',
      { trackId: 'track-1' },
      { jobId: 'metadata-processing-2' },
    );
  });

  it('queues nothing for a Track that has no Processing', async () => {
    processings.findLatestProcessing.mockResolvedValue(undefined);

    await service.enqueueImport('track-1');

    expect(queue.add).not.toHaveBeenCalled();
  });
});
