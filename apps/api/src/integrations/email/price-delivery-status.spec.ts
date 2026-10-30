import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ENV, parseEnv } from '../../config/env.js';
import { EMAIL_QUEUE } from './email.job.js';
import { EmailService } from './email.service.js';

const env = parseEnv({
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
});
const job = {
  getState: vi.fn(),
  retry: vi.fn(),
  finishedOn: Date.parse('2026-01-01T00:00:00Z'),
  attemptsMade: 0,
  failedReason: '',
};
const queue = { getJob: vi.fn() };

describe('confirmed email delivery state', () => {
  let service: EmailService;
  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ENV, useValue: env },
        { provide: getQueueToken(EMAIL_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(EmailService);
  });
  it('distinguishes missing, queued, failed and confirmed delivery', async () => {
    queue.getJob.mockResolvedValueOnce(undefined).mockResolvedValue(job);
    expect(await service.delivery('notice')).toEqual({ state: 'missing' });
    job.getState
      .mockResolvedValueOnce('waiting')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('completed');
    expect(await service.delivery('notice')).toEqual({ state: 'pending' });
    expect(await service.delivery('notice')).toEqual({ state: 'failed' });
    expect(await service.delivery('notice')).toEqual({
      state: 'sent',
      sentAt: new Date('2026-01-01T00:00:00Z'),
    });
  });
  it('distinguishes a first definitive rejection from ambiguous attempts', async () => {
    queue.getJob.mockResolvedValue(job);
    job.getState.mockResolvedValue('failed');
    job.attemptsMade = 1;
    job.failedReason = 'Resend rejected the email with HTTP 403';
    expect(await service.delivery('notice')).toEqual({ state: 'rejected' });
    job.attemptsMade = 2;
    expect(await service.delivery('notice')).toEqual({ state: 'failed' });
    job.attemptsMade = 1;
    job.failedReason = 'Resend rejected the email with HTTP 429';
    expect(await service.delivery('notice')).toEqual({ state: 'failed' });
    job.failedReason = '';
    job.attemptsMade = 0;
  });
  it('retries only an existing failed job', async () => {
    queue.getJob.mockResolvedValue(job);
    job.getState
      .mockResolvedValueOnce('waiting')
      .mockResolvedValueOnce('failed');
    await service.retryDelivery('notice');
    expect(job.retry).not.toHaveBeenCalled();
    await service.retryDelivery('notice');
    expect(job.retry).toHaveBeenCalledTimes(1);
  });
});
