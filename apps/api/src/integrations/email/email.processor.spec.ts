import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Job, UnrecoverableError } from 'bullmq';
import { ENV, type Env, parseEnv } from '../../config/env.js';
import { EmailProcessor } from './email.processor.js';

const message = {
  to: 'ana@example.com',
  subject: 'Your code',
  html: '<p>123456</p>',
  text: '123456',
};

const createProcessor = async (overrides: Record<string, string> = {}) => {
  const env: Env = parseEnv({
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'notefinder <noreply@notefinder.com.br>',
    ...overrides,
  });
  const moduleRef = await Test.createTestingModule({
    providers: [EmailProcessor, { provide: ENV, useValue: env }],
  }).compile();
  return moduleRef.get(EmailProcessor);
};

const createJob = (data: unknown) => ({ id: '42', data }) as Job<unknown>;

describe('EmailProcessor', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends through Resend with the job ID as idempotency key', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'email-id' }));
    const processor = await createProcessor();

    await processor.process(createJob(message));

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_test',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'email-42',
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: 'notefinder <noreply@notefinder.com.br>',
      to: ['ana@example.com'],
      subject: 'Your code',
      html: '<p>123456</p>',
      text: '123456',
    });
    // Never log message contents when actually sending.
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('123456');
  });

  it.each([500, 429])('retries on HTTP %i', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    const processor = await createProcessor();

    const result = processor.process(createJob(message));
    await expect(result).rejects.toThrow(`HTTP ${status}`);
    await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
  });

  it.each([400, 401, 422])('gives up on HTTP %i', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    const processor = await createProcessor();

    await expect(processor.process(createJob(message))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('logs the email instead of sending it without an API key', async () => {
    const processor = await createProcessor({ RESEND_API_KEY: '' });

    await processor.process(createJob(message));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('123456'));
  });

  it('fails invalid payloads without retrying', async () => {
    const processor = await createProcessor();

    await expect(
      processor.process(createJob({ ...message, to: 'not-an-email' })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
