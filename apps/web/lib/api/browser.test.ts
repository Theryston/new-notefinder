import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  // The client env is cached per module instance.
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(Response.json({ ok: true }));
});

describe('browserApi', () => {
  it('calls NEXT_PUBLIC_API_URL with credentials', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test');
    const { browserApi } = await import('./browser');

    await expect(
      browserApi('/me', { schema: z.object({ ok: z.boolean() }) }),
    ).resolves.toEqual({ ok: true });

    const [input, init] = fetchMock.mock.lastCall ?? [];
    expect(String(input)).toBe('https://api.example.test/v1/me');
    expect(init?.credentials).toBe('include');
  });

  it('fails with a readable error when NEXT_PUBLIC_API_URL is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
    const { browserApi } = await import('./browser');

    // Throws synchronously: the env is read before the request starts.
    expect(() => browserApi('/me', { schema: z.object() })).toThrow(
      /Invalid public environment variables:\n {2}- NEXT_PUBLIC_API_URL/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
