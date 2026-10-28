import { describe, expect, it, vi } from 'vitest';
import { readPendingAttempt } from './pending-attempt';
import { reportAttempt } from './report-attempt';

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

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
  };
};

const keepView = (storage: ReturnType<typeof memory>, viewId: string) =>
  storage.setItem(
    'vozzify:track-view:track-1',
    JSON.stringify({ viewId, attached: true }),
  );

describe('reportAttempt view attribution', () => {
  it('submits a signed-in attempt with its stored view', () => {
    const storage = memory();
    keepView(storage, 'stored-view');
    const submit = vi.fn();

    reportAttempt({
      signedIn: true,
      trackId: 'track-1',
      body: { ...body },
      submit,
      storage,
    });

    expect(submit).toHaveBeenCalledWith({ ...body, viewId: 'stored-view' });
  });

  it('keeps the view on a pending visitor attempt for later submission', () => {
    const storage = memory();
    keepView(storage, 'stored-view');

    reportAttempt({
      signedIn: false,
      trackId: 'track-1',
      body: { ...body },
      submit: vi.fn(),
      storage,
    });

    expect(readPendingAttempt(storage, 'track-1')?.body).toEqual({
      ...body,
      viewId: 'stored-view',
    });
  });

  it('preserves an explicit view id instead of replacing it from storage', () => {
    const storage = memory();
    keepView(storage, 'stored-view');
    const submit = vi.fn();

    reportAttempt({
      signedIn: true,
      trackId: 'track-1',
      body: { ...body, viewId: 'explicit-view' },
      submit,
      storage,
    });

    expect(submit).toHaveBeenCalledWith({ ...body, viewId: 'explicit-view' });
  });

  it('leaves the body unchanged when no stored or explicit view id exists', () => {
    const submit = vi.fn();

    reportAttempt({
      signedIn: true,
      trackId: 'track-1',
      body: { ...body },
      submit,
      storage: memory(),
    });

    expect(submit).toHaveBeenCalledWith({ ...body });
  });
});
