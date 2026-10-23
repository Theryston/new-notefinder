import { afterEach, expect, it, vi } from 'vitest';

import { postTrackView } from './track-view-query';
import { synchronizeTrackView } from './track-view-sync';

vi.mock('./track-view-query', () => ({ postTrackView: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it('shares the pending anonymous view across remounts and attaches after sign-in', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  let complete: (id: string) => void = () => {};
  vi.mocked(postTrackView)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue('anonymous-view');

  const anonymous = synchronizeTrackView('pending-track', false);
  const remounted = synchronizeTrackView('pending-track', false);
  const signedIn = synchronizeTrackView('pending-track', true);
  expect(postTrackView).toHaveBeenCalledTimes(1);
  complete('anonymous-view');
  await Promise.all([anonymous, remounted, signedIn]);

  expect(postTrackView).toHaveBeenCalledTimes(2);
  expect(postTrackView).toHaveBeenNthCalledWith(
    2,
    'pending-track',
    'anonymous-view',
  );
  await synchronizeTrackView('pending-track', true);
  expect(postTrackView).toHaveBeenCalledTimes(2);
});

it('releases a failed request so a later visit can retry', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.mocked(postTrackView)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce('retried-view');
  await expect(synchronizeTrackView('retry-track', false)).rejects.toThrow(
    'offline',
  );
  await synchronizeTrackView('retry-track', false);
  await synchronizeTrackView('retry-track', false);
  expect(postTrackView).toHaveBeenCalledTimes(2);
});

it('sends the displayed locale when it records the view, not when it attaches', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.mocked(postTrackView).mockResolvedValue('locale-view');

  await synchronizeTrackView('locale-track', false, 'pt-BR');
  await synchronizeTrackView('locale-track', true, 'en');

  expect(postTrackView).toHaveBeenNthCalledWith(
    1,
    'locale-track',
    undefined,
    'pt-BR',
  );
  expect(postTrackView).toHaveBeenNthCalledWith(
    2,
    'locale-track',
    'locale-view',
  );
});
