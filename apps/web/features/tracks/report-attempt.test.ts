import { describe, expect, it, vi } from 'vitest';

import { readPendingAttempt } from './pending-attempt';
import { reportAttempt } from './report-attempt';

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

describe('reportAttempt', () => {
  it('submits a signed-in User run at once', () => {
    const submit = vi.fn();
    const storage = memory();

    reportAttempt({
      signedIn: true,
      trackId: 't1',
      body: { ...body },
      submit,
      storage,
    });

    expect(submit).toHaveBeenCalledWith({ ...body });
    expect(readPendingAttempt(storage, 't1')).toBeUndefined();
  });

  it('keeps a visitor run in the session for the sign-in', () => {
    const submit = vi.fn();
    const storage = memory();

    reportAttempt({
      signedIn: false,
      trackId: 't1',
      body: { ...body },
      submit,
      storage,
    });

    expect(submit).not.toHaveBeenCalled();
    expect(readPendingAttempt(storage, 't1')).toEqual({
      trackId: 't1',
      body: { ...body },
    });
  });
});
