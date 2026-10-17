import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserQueryOptions } from './current-user-query';
import { authKeys } from './query-keys';

const fetchMock = vi.fn<typeof fetch>();

function query() {
  const options = currentUserQueryOptions();
  const queryFn = options.queryFn;
  if (typeof queryFn !== 'function') throw new Error('no query function');
  return {
    options,
    run: (body: unknown, status = 200) => {
      fetchMock.mockResolvedValue(Response.json(body, { status }));
      const signal = new AbortController().signal;
      return {
        result: queryFn({ signal } as Parameters<typeof queryFn>[0]),
        signal,
      };
    },
  };
}

describe('currentUserQueryOptions', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
    vi.stubGlobal('fetch', fetchMock);
  });

  it('reads the stored target under the current-user key', async () => {
    const { options, run } = query();

    expect(options.queryKey).toEqual(authKeys.currentUser());
    await expect(
      run({ dailyPracticeTargetSeconds: 900 }).result,
    ).resolves.toEqual({
      dailyPracticeTargetSeconds: 900,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v1/me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it.each([null, undefined, 40, '600', 300.5])(
    'reads %p as the fallback',
    async (stored) => {
      const { run } = query();

      await expect(
        run({ dailyPracticeTargetSeconds: stored }).result,
      ).resolves.toEqual({ dailyPracticeTargetSeconds: null });
    },
  );

  it('reads a response without the field as the fallback', async () => {
    const { run } = query();

    await expect(run({}).result).resolves.toEqual({
      dailyPracticeTargetSeconds: null,
    });
  });

  it('throws when the read fails, so the form falls back instead', async () => {
    const { run } = query();

    await expect(run({ code: 'UNAUTHORIZED' }, 401).result).rejects.toThrow(
      'Daily target lookup failed (401)',
    );
  });
});
