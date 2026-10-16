import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

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

describe('submitPendingAttempt', () => {
  it('submits the waiting run, forgets it and reads the state again', async () => {
    const storage = memory();
    writePendingAttempt(storage, { trackId: 't1', body: { ...body } });
    mockBrowserApi.mockResolvedValue({ id: 'attempt-1' });
    const queryClient = new QueryClient();
    queryClient.setQueryData(trackKeys.userState('t1'), {
      isFavorite: false,
    });

    await expect(
      submitPendingAttempt({ trackId: 't1', queryClient, storage }),
    ).resolves.toBe(true);

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

  it('forgets a run the API refuses, without reading the state again', async () => {
    const storage = memory();
    writePendingAttempt(storage, { trackId: 't1', body: { ...body } });
    mockBrowserApi.mockRejectedValue(new Error('gone'));
    const queryClient = new QueryClient();

    await expect(
      submitPendingAttempt({ trackId: 't1', queryClient, storage }),
    ).resolves.toBe(true);

    expect(storage.getItem('notefinder:pending-attempt:t1')).toBeNull();
    expect(
      queryClient.getQueryState(trackKeys.userState('t1'))?.isInvalidated,
    ).not.toBe(true);
  });

  it('sends nothing when nothing waits', async () => {
    const queryClient = new QueryClient();

    await expect(
      submitPendingAttempt({
        trackId: 't1',
        queryClient,
        storage: memory(),
      }),
    ).resolves.toBe(false);

    expect(mockBrowserApi).not.toHaveBeenCalled();
  });
});
