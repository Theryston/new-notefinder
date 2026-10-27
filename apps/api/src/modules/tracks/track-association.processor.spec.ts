import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import {
  DELIVER_TRACK_ASSOCIATIONS_JOB,
  TRACK_ASSOCIATION_POLL_INTERVAL_MS,
  TRACK_ASSOCIATION_QUEUE,
  TRACK_ASSOCIATION_SCHEDULER_ID,
} from './track-association.job.js';
import { TrackAssociationProcessor } from './track-association.processor.js';
import { TrackAssociationService } from './track-association.service.js';

const queue = { upsertJobScheduler: vi.fn() };
const associations = { dispatchPending: vi.fn() };

describe('TrackAssociationProcessor', () => {
  let processor: TrackAssociationProcessor;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    queue.upsertJobScheduler.mockResolvedValue(undefined);
    associations.dispatchPending.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackAssociationProcessor,
        { provide: getQueueToken(TRACK_ASSOCIATION_QUEUE), useValue: queue },
        { provide: TrackAssociationService, useValue: associations },
      ],
    }).compile();
    processor = moduleRef.get(TrackAssociationProcessor);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('registers durable outbox polling on boot', async () => {
    await processor.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      TRACK_ASSOCIATION_SCHEDULER_ID,
      { every: TRACK_ASSOCIATION_POLL_INTERVAL_MS },
      { name: DELIVER_TRACK_ASSOCIATIONS_JOB, data: {} },
    );
  });

  it('dispatches pending rows for a valid recurring job', async () => {
    await processor.process({
      name: DELIVER_TRACK_ASSOCIATIONS_JOB,
      data: {},
    } as Job<unknown>);

    expect(associations.dispatchPending).toHaveBeenCalledOnce();
  });

  it('rejects unknown recurring jobs', async () => {
    await expect(
      processor.process({ name: 'unknown', data: {} } as Job<unknown>),
    ).rejects.toThrow('Invalid Track association job');
  });
});
