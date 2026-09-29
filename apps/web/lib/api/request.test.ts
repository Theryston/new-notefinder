import { cursorPageSchema } from '@notefinder/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError } from './api-error';
import { apiRequest } from './request';

const itemSchema = z.object({ id: z.string(), plays: z.number() });
const pageSchema = cursorPageSchema(itemSchema);

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

function lastCall() {
  const call = fetchMock.mock.lastCall;
  if (!call) throw new Error('fetch was not called');
  const [input, init = {}] = call;
  return { url: String(input), init, headers: new Headers(init.headers) };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('apiRequest', () => {
  describe('URL', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(Response.json({}));
    });

    it('prefixes the path with /v1', async () => {
      await apiRequest('http://api.test', '/tracks', { schema: z.object() });
      expect(lastCall().url).toBe('http://api.test/v1/tracks');
    });

    it('keeps a base URL path prefix and drops trailing slashes', async () => {
      await apiRequest('http://gw.test/api//', '/tracks/abc', {
        schema: z.object(),
      });
      expect(lastCall().url).toBe('http://gw.test/api/v1/tracks/abc');
    });

    it('serializes query params and omits null/undefined', async () => {
      await apiRequest('http://api.test', '/search', {
        schema: z.object(),
        query: {
          q: 'queen & co',
          limit: 10,
          exact: false,
          a: null,
          b: undefined,
        },
      });
      const url = new URL(lastCall().url);
      expect([...url.searchParams]).toEqual([
        ['q', 'queen & co'],
        ['limit', '10'],
        ['exact', 'false'],
      ]);
    });
  });

  describe('request', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(Response.json({}));
    });

    it('sends GET with an accept header and no body by default', async () => {
      await apiRequest('http://api.test', '/tracks', { schema: z.object() });
      const { init, headers } = lastCall();
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      expect(headers.get('accept')).toBe('application/json');
      expect(headers.has('content-type')).toBe(false);
    });

    it('sends a JSON body with its content type', async () => {
      await apiRequest('http://api.test', '/tracks', {
        schema: z.object(),
        method: 'POST',
        body: { videoId: 'abc' },
        headers: { 'x-custom': '1' },
      });
      const { init, headers } = lastCall();
      expect(init.method).toBe('POST');
      expect(init.body).toBe('{"videoId":"abc"}');
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('x-custom')).toBe('1');
    });

    it('sends a FormData body as is, leaving the multipart boundary to fetch', async () => {
      const form = new FormData();
      form.set('name', 'Ada Lovelace');

      await apiRequest('http://api.test', '/me', {
        schema: z.object(),
        method: 'PATCH',
        body: form,
      });

      const { init, headers } = lastCall();
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(form);
      // Set by fetch, with the boundary; a value set here would break it.
      expect(headers.has('content-type')).toBe(false);
    });

    it('merges extra fetch init (e.g. credentials)', async () => {
      await apiRequest(
        'http://api.test',
        '/me',
        { schema: z.object() },
        { credentials: 'include' },
      );
      expect(lastCall().init.credentials).toBe('include');
    });
  });

  describe('success responses', () => {
    it('parses the body with the contract schema', async () => {
      fetchMock.mockResolvedValue(
        Response.json({
          items: [{ id: 'clx1', plays: 3, extra: 'stripped' }],
          nextCursor: null,
        }),
      );

      await expect(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      ).resolves.toEqual({
        items: [{ id: 'clx1', plays: 3 }],
        nextCursor: null,
      });
    });

    it('handles 204 No Content', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await expect(
        apiRequest('http://api.test', '/tracks/abc', {
          schema: z.undefined(),
          method: 'DELETE',
        }),
      ).resolves.toBeUndefined();
    });

    it('throws INTERNAL_ERROR when the body does not match the contract', async () => {
      fetchMock.mockResolvedValue(Response.json({ items: 'nope' }));

      const error = await rejection(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('/v1/tracks'),
      });
      expect((error as ApiError).cause).toBeInstanceOf(z.ZodError);
    });

    it('throws INTERNAL_ERROR when a 200 body is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('<html>'));

      await expect(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    });
  });

  describe('error responses', () => {
    it('turns the error envelope into a typed ApiError', async () => {
      fetchMock.mockResolvedValue(
        Response.json(
          {
            statusCode: 404,
            code: 'NOT_FOUND',
            message: 'Track not found',
            details: { trackId: 'abc' },
          },
          { status: 404 },
        ),
      );

      const error = await rejection(
        apiRequest('http://api.test', '/tracks/abc', { schema: itemSchema }),
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).toJSON()).toEqual({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Track not found',
        details: { trackId: 'abc' },
      });
    });

    it('maps a non-envelope JSON error to INTERNAL_ERROR with its status', async () => {
      fetchMock.mockResolvedValue(
        Response.json({ error: 'Bad Gateway' }, { status: 502 }),
      );

      await expect(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: 502,
        code: 'INTERNAL_ERROR',
      });
    });

    it('maps a non-JSON error to INTERNAL_ERROR with its status', async () => {
      fetchMock.mockResolvedValue(
        new Response('Service Unavailable', { status: 503 }),
      );

      await expect(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      ).rejects.toMatchObject({ statusCode: 503, code: 'INTERNAL_ERROR' });
    });

    it('maps an envelope with an unknown code to INTERNAL_ERROR', async () => {
      fetchMock.mockResolvedValue(
        Response.json(
          { statusCode: 418, code: 'TEAPOT', message: 'no' },
          { status: 418 },
        ),
      );

      await expect(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      ).rejects.toMatchObject({ statusCode: 418, code: 'INTERNAL_ERROR' });
    });

    it('maps a network failure to INTERNAL_ERROR keeping the cause', async () => {
      const cause = new TypeError('fetch failed');
      fetchMock.mockRejectedValue(cause);

      const error = await rejection(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
      expect((error as ApiError).cause).toBe(cause);
    });

    it('rethrows aborts untouched', async () => {
      const abort = new DOMException('Aborted', 'AbortError');
      fetchMock.mockRejectedValue(abort);

      await expect(
        apiRequest('http://api.test', '/tracks', { schema: pageSchema }),
      ).rejects.toBe(abort);
    });
  });
});
