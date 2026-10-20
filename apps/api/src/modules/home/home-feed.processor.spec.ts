import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Job, UnrecoverableError } from 'bullmq';
import {
  HOME_FEED_QUEUE,
  PUBLIC_HOME_FEED_CRON,
  PUBLIC_HOME_FEED_SCHEDULER_ID,
  REFRESH_PUBLIC_HOME_FEED_JOB,
} from './home-feed.job.js';
import { HomeFeedProcessor } from './home-feed.processor.js';
import { HomeFeedService } from './home-feed.service.js';

const createJob = (name: string) => ({ id: '1', name, data: {} }) as Job;

describe('HomeFeedProcessor', () => {
  let processor: HomeFeedProcessor;
  const feeds = { refreshPublic: vi.fn() };
  const queue = { upsertJobScheduler: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queue.upsertJobScheduler.mockResolvedValue(undefined);
    feeds.refreshPublic.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        HomeFeedProcessor,
        { provide: HomeFeedService, useValue: feeds },
        { provide: getQueueToken(HOME_FEED_QUEUE), useValue: queue },
      ],
    }).compile();
    processor = moduleRef.get(HomeFeedProcessor);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the hourly UTC scheduler on boot', async () => {
    await processor.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      PUBLIC_HOME_FEED_SCHEDULER_ID,
      { pattern: PUBLIC_HOME_FEED_CRON, tz: 'UTC' },
      { name: REFRESH_PUBLIC_HOME_FEED_JOB, data: {} },
    );
  });

  it('warms the public feed on boot, before the app is ready', async () => {
    await processor.onModuleInit();

    expect(feeds.refreshPublic).toHaveBeenCalledOnce();
  });

  it('keeps booting when the warm-up fails: the first request builds it', async () => {
    feeds.refreshPublic.mockRejectedValue(new Error('database down'));

    await expect(processor.onModuleInit()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('regenerates the public feed for the refresh job', async () => {
    await processor.process(createJob(REFRESH_PUBLIC_HOME_FEED_JOB));

    expect(feeds.refreshPublic).toHaveBeenCalledOnce();
  });

  it('fails a job it does not know without retrying', async () => {
    await expect(processor.process(createJob('other'))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(feeds.refreshPublic).not.toHaveBeenCalled();
  });
});
