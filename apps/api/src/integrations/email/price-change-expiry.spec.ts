import type { Job } from 'bullmq';
import { parseEnv } from '../../config/env.js';
import { EmailProcessor } from './email.processor.js';

describe('price notice delivery deadline', () => {
  it('does not send a queued notice after its idempotency deadline', async () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'vozzify <noreply@vozzify.com>',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const job = {
        id: 'price-change-1',
        data: {
          to: 'singer@example.com',
          subject: 'Price',
          html: '<p>Price</p>',
          text: 'Price',
          sendBefore: '2020-01-01T00:00:00.000Z',
        },
      } as Job<unknown>;
      await expect(new EmailProcessor(env).process(job)).rejects.toThrow(
        'Email idempotency window expired',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
