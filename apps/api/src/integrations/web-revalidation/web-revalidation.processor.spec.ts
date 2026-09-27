import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Job, UnrecoverableError } from 'bullmq';
import { ENV, type Env, parseEnv } from '../../config/env.js';
import { WebRevalidationProcessor } from './web-revalidation.processor.js';

const SECRET = 'a'.repeat(32);

const createProcessor = async (overrides: Record<string, string> = {}) => {
  const env: Env = parseEnv({
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    WEB_URL: 'https://web.example/',
    REVALIDATE_SECRET: SECRET,
    BETTER_AUTH_SECRET: SECRET,
    ...overrides,
  });
  const moduleRef = await Test.createTestingModule({
    providers: [WebRevalidationProcessor, { provide: ENV, useValue: env }],
  }).compile();
  return moduleRef.get(WebRevalidationProcessor);
};

const createJob = (data: unknown) => ({ id: '1', data }) as Job<unknown>;

describe('WebRevalidationProcessor', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs the tags with the bearer secret', async () => {
    fetchMock.mockResolvedValue(Response.json({ revalidated: ['home'] }));
    const processor = await createProcessor();

    await processor.process(createJob({ tags: ['home', 'track:t1'] }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://web.example/api/revalidate');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: ['home', 'track:t1'] }),
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([500, 502, 408, 429])(
    'throws a retryable error on HTTP %i',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      const processor = await createProcessor();

      const result = processor.process(createJob({ tags: ['home'] }));
      await expect(result).rejects.toThrow(`HTTP ${status}`);
      await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
    },
  );

  it.each([400, 401, 404])(
    'throws an unrecoverable error on HTTP %i',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      const processor = await createProcessor();

      await expect(
        processor.process(createJob({ tags: ['home'] })),
      ).rejects.toBeInstanceOf(UnrecoverableError);
    },
  );

  it('lets network errors propagate so the job is retried', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const processor = await createProcessor();

    await expect(
      processor.process(createJob({ tags: ['home'] })),
    ).rejects.toThrow('fetch failed');
  });

  it('skips without calling the web when the secret is missing', async () => {
    const processor = await createProcessor({ REVALIDATE_SECRET: '' });

    await expect(
      processor.process(createJob({ tags: ['home'] })),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails invalid payloads without retrying', async () => {
    const processor = await createProcessor();

    await expect(
      processor.process(createJob({ tags: [] })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
