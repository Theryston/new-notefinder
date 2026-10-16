import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser';

import { writePendingAttempt } from './pending-attempt';
import { trackKeys } from './query-keys';
import { submitPendingAttempt } from './submit-pending-attempt';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
  };
};

const body = {
  difficulty: 'NORMAL',
  octaveMode: 'ANY',
  transposeSemitones: 0,
  speed: 1,
  accuracy: 0.8,
  coverage: 0.95,
  forwardSkip: false,
  bleedSuspected: false,
  startedAt: '2026-10-16T10:00:00.000Z',
  endedAt: '2026-10-16T10:04:00.000Z',
} as const;

const pending = { trackId: 't1', body: { ...body } };

const rejected = (statusCode: number) =>
  new ApiError({ statusCode, code: 'ATTEMPT_REJECTED', message: 'refused' });

describe('submitPendingAttempt', () => {
  it('submits the waiting run, forgets it and reads the state again', async () => {
    const storage = memory();
    writePendingAttempt(storage, pending);
    mockBrowserApi.mockResolvedValue({ id: 'attempt-1' });
    const queryClient = new QueryClient();
    queryClient.setQueryData(trackKeys.userState('t1'), {
      isFavorite: false,
    });

    await submitPendingAttempt({ queryClient, storage, pending });

    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/t1/attempts', {
      method: 'POST',
      body: { ...body },
      schema: expect.anything(),
    });
    expect(storage.getItem('notefinder:pending-attempt:t1')).toBeNull();
    expect(
      queryClient.getQueryState(trackKeys.userState('t1'))?.isInvalidated,
    ).toBe(true);
  });

  it.each([400, 404, 422])(
    'forgets a run refused with %i, without reading the state again',
    async (statusCode) => {
      const storage = memory();
      writePendingAttempt(storage, pending);
      mockBrowserApi.mockRejectedValue(rejected(statusCode));
      const queryClient = new QueryClient();

      await expect(
        submitPendingAttempt({ queryClient, storage, pending }),
      ).rejects.toBeInstanceOf(ApiError);

      expect(storage.getItem('notefinder:pending-attempt:t1')).toBeNull();
      expect(
        queryClient.getQueryState(trackKeys.userState('t1'))?.isInvalidated,
      ).not.toBe(true);
    },
  );

  it.each(['network failure', 500, 429])(
    'keeps a run whose submit may still succeed (%s)',
    async (failure) => {
      const storage = memory();
      writePendingAttempt(storage, pending);
      mockBrowserApi.mockRejectedValue(
        typeof failure === 'number' ? rejected(failure) : new Error('gone'),
      );
      const queryClient = new QueryClient();

      await expect(
        submitPendingAttempt({ queryClient, storage, pending }),
      ).rejects.toThrow();

      expect(storage.getItem('notefinder:pending-attempt:t1')).not.toBeNull();
    },
  );
});
