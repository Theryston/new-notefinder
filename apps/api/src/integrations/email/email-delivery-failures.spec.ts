import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import { ENV, parseEnv } from '../../config/env.js';
import { EmailProcessor } from './email.processor.js';

const message = {
  to: 'user@example.com',
  subject: 'Private subject',
  html: '<p>Private body</p>',
  text: 'Private body',
};

describe('Email delivery failure logging', () => {
  let module: TestingModule;
  let queue: Queue;
  let processor: EmailProcessor;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    module = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: ENV,
          useValue: parseEnv({
            DATABASE_URL: 'postgres://user:pass@localhost/db',
            REDIS_URL: 'redis://localhost:6379',
            BETTER_AUTH_SECRET: 'a'.repeat(32),
            RESEND_API_KEY: 'test-key',
          }),
        },
      ],
    }).compile();
    processor = module.get(EmailProcessor);
    queue = new Queue('email-failure-test', {
      connection: { lazyConnect: true },
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await queue.close();
    await module.close();
  });

  it.each(['provider rejection', 'network failure'])(
    'logs %s without swallowing retryable errors or message contents',
    async (failure) => {
      if (failure === 'provider rejection') {
        fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
      } else {
        fetchMock.mockRejectedValue(new Error('Network unavailable'));
      }
      const log = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const job = new Job(queue, 'send', message, {}, '42');
      job.attemptsMade = 1;
      const error = await processor
        .process(job)
        .catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) {
        throw new Error(
          'The worker must reject failed delivery for BullMQ to retry',
        );
      }
      processor.onFailed(job, error);
      expect(log).toHaveBeenCalledWith(
        `Email delivery failed (job 42, attempt 1): ${error.message}`,
      );
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /user@example.com|Private|test-key/,
      );
    },
  );

  it('logs a failure even when BullMQ has already removed the job', () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    processor.onFailed(undefined, new Error('Missing job'));
    expect(log).toHaveBeenCalledWith(
      'Email delivery failed (job unknown, attempt 0): Missing job',
    );
  });
});
