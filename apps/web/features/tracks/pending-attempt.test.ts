import { describe, expect, it } from 'vitest';

import {
  clearPendingAttempt,
  type PendingAttempt,
  readPendingAttempt,
  writePendingAttempt,
} from './pending-attempt';

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

const attempt = (trackId: string): PendingAttempt => ({
  trackId,
  body: {
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
  },
});

describe('pending attempt', () => {
  it('keeps the visitor run for the sign-in to submit, then forgets it', () => {
    const storage = memory();

    expect(readPendingAttempt(storage, 'track-1')).toBeUndefined();
    writePendingAttempt(storage, attempt('track-1'));
    expect(readPendingAttempt(storage, 'track-1')).toEqual(attempt('track-1'));
    clearPendingAttempt(storage, 'track-1');
    expect(readPendingAttempt(storage, 'track-1')).toBeUndefined();
  });

  it('keeps each Track runs apart', () => {
    const storage = memory();
    writePendingAttempt(storage, attempt('track-1'));

    expect(readPendingAttempt(storage, 'track-2')).toBeUndefined();
  });

  it('ignores what is not a run anymore', () => {
    const storage = memory();
    storage.setItem(
      'notefinder:pending-attempt:track-1',
      JSON.stringify({ trackId: 'track-1', body: { accuracy: 'high' } }),
    );

    expect(readPendingAttempt(storage, 'track-1')).toBeUndefined();
  });

  it('ignores what is not JSON at all', () => {
    const storage = memory();
    storage.setItem('notefinder:pending-attempt:track-1', 'not json{');

    expect(readPendingAttempt(storage, 'track-1')).toBeUndefined();
  });

  it('survives blocked storage', () => {
    expect(readPendingAttempt(undefined, 'track-1')).toBeUndefined();
    expect(() =>
      writePendingAttempt(undefined, attempt('track-1')),
    ).not.toThrow();
    expect(() => clearPendingAttempt(undefined, 'track-1')).not.toThrow();
  });
});
