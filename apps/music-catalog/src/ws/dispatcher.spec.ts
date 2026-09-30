import { CatalogError } from '../errors/catalog-error.js';
import { createDispatcher } from './dispatcher.js';
import type { Handler } from './handler.js';

const fakeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

const request = (fields: Record<string, unknown>) =>
  JSON.stringify({ id: 'r1', type: 'status', ...fields });

const setup = (handle: Handler['handle'], requestTimeoutMs = 1000) => {
  const logger = fakeLogger();
  const dispatch = createDispatcher({
    handlers: [{ type: 'status', handle }],
    requestTimeoutMs,
    logger,
  });
  return { dispatch, logger };
};

describe('createDispatcher', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers a request with its handler result and its id', async () => {
    const handle = vi.fn(async () => ({ phase: 'ready' }));
    const { dispatch } = setup(handle);

    const response = await dispatch(request({ payload: { a: 1 } }));

    expect(response).toEqual({
      id: 'r1',
      ok: true,
      result: { phase: 'ready' },
    });
    expect(handle).toHaveBeenCalledExactlyOnceWith({ a: 1 });
  });

  it('answers UNKNOWN_REQUEST_TYPE for a type nothing handles', async () => {
    const { dispatch } = setup(async () => ({}));

    const response = await dispatch(request({ type: 'teleport' }));

    expect(response).toEqual({
      id: 'r1',
      ok: false,
      error: {
        code: 'UNKNOWN_REQUEST_TYPE',
        message: 'Unknown request type "teleport"',
      },
    });
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'does not mistake the object property "%s" for a request type',
    async (type) => {
      const { dispatch } = setup(async () => ({}));

      const response = await dispatch(request({ type }));

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_REQUEST_TYPE' },
      });
    },
  );

  it('answers VALIDATION_FAILED without an id for text that is not JSON', async () => {
    const { dispatch } = setup(async () => ({}));

    const response = await dispatch('{oops');

    expect(response).toEqual({
      id: null,
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: expect.any(String) },
    });
  });

  it('answers VALIDATION_FAILED with the id when only the type is missing', async () => {
    const { dispatch } = setup(async () => ({}));

    const response = await dispatch('{"id":"r9"}');

    expect(response).toMatchObject({
      id: 'r9',
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('keeps the code of an expected failure of the handler', async () => {
    const { dispatch, logger } = setup(async () => {
      throw new CatalogError('CATALOG_NOT_READY', 'Still importing');
    });

    const response = await dispatch(request({}));

    expect(response).toEqual({
      id: 'r1',
      ok: false,
      error: { code: 'CATALOG_NOT_READY', message: 'Still importing' },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('answers INTERNAL, hiding the cause, and logs it for the operator', async () => {
    const cause = new Error('password authentication failed for user "x"');
    const { dispatch, logger } = setup(async () => {
      throw cause;
    });

    const response = await dispatch(request({}));

    expect(response).toEqual({
      id: 'r1',
      ok: false,
      error: { code: 'INTERNAL', message: 'Internal error' },
    });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith('Request failed', {
      id: 'r1',
      type: 'status',
      error: cause,
    });
  });

  describe('timeout', () => {
    it('answers INTERNAL when the handler takes longer than the timeout', async () => {
      vi.useFakeTimers();
      const { dispatch, logger } = setup(
        () => new Promise<never>(() => undefined),
        500,
      );

      const pending = dispatch(request({}));
      await vi.advanceTimersByTimeAsync(499);
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toEqual({
        id: 'r1',
        ok: false,
        error: { code: 'INTERNAL', message: 'Request timed out' },
      });
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Request timed out', {
        id: 'r1',
        type: 'status',
        timeoutMs: 500,
      });
    });

    it('leaves no timer behind once the handler answers', async () => {
      vi.useFakeTimers();
      const { dispatch } = setup(async () => ({ phase: 'ready' }), 500);

      await dispatch(request({}));

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('answers requests independently, whatever order they finish in', async () => {
    vi.useFakeTimers();
    const { dispatch } = setup(async (payload) => {
      const { delay } = payload as { delay: number };
      await new Promise((resolve) => setTimeout(resolve, delay));
      return { delay };
    });
    const finished: unknown[] = [];

    const slow = dispatch(request({ id: 'slow', payload: { delay: 200 } }));
    const fast = dispatch(request({ id: 'fast', payload: { delay: 50 } }));
    void slow.then((response) => finished.push(response));
    void fast.then((response) => finished.push(response));
    await vi.advanceTimersByTimeAsync(200);

    expect(finished).toEqual([
      { id: 'fast', ok: true, result: { delay: 50 } },
      { id: 'slow', ok: true, result: { delay: 200 } },
    ]);
  });
});

describe('createDispatcher with a moved Recording', () => {
  it('answers the new MBID the handler reports', async () => {
    const newMbid = '00000000-0000-4000-8000-000000000100';
    const { dispatch } = setup(async () => {
      throw new CatalogError('RECORDING_MOVED', 'Merged', { newMbid });
    });

    const response = await dispatch(request({}));

    expect(response).toStrictEqual({
      id: 'r1',
      ok: false,
      error: { code: 'RECORDING_MOVED', message: 'Merged', newMbid },
    });
  });

  it('answers a failure without a new MBID with none', async () => {
    const { dispatch } = setup(async () => {
      throw new CatalogError('RECORDING_NOT_FOUND', 'Unknown');
    });

    const response = await dispatch(request({}));

    expect(response).toStrictEqual({
      id: 'r1',
      ok: false,
      error: { code: 'RECORDING_NOT_FOUND', message: 'Unknown' },
    });
  });
});
