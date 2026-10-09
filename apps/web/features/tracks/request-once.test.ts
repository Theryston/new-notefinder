import { describe, expect, it } from 'vitest';

import {
  hasRequested,
  markRequested,
  type RequestMarks,
  unmarkRequested,
} from './request-once';

const MBID = '00000000-0000-4000-8000-000000000002';
const OTHER = '00000000-0000-4000-8000-000000000003';

/** A storage that keeps its marks in memory, like session storage does. */
function memoryMarks(): RequestMarks {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/** A storage the browser refuses to use, as in some private windows. */
const refusedMarks: RequestMarks = {
  getItem: () => {
    throw new Error('storage denied');
  },
  setItem: () => {
    throw new Error('storage denied');
  },
  removeItem: () => {
    throw new Error('storage denied');
  },
};

describe('request marks', () => {
  it('knows a Recording is requested once it is marked, and only that one', () => {
    const marks = memoryMarks();

    expect(hasRequested(marks, MBID)).toBe(false);
    markRequested(marks, MBID);

    expect(hasRequested(marks, MBID)).toBe(true);
    expect(hasRequested(marks, OTHER)).toBe(false);
  });

  it('forgets a mark, so a failed request can be made again', () => {
    const marks = memoryMarks();
    markRequested(marks, MBID);

    unmarkRequested(marks, MBID);

    expect(hasRequested(marks, MBID)).toBe(false);
  });

  it('reads as no mark when the browser has no storage', () => {
    expect(hasRequested(undefined, MBID)).toBe(false);
    expect(() => markRequested(undefined, MBID)).not.toThrow();
    expect(() => unmarkRequested(undefined, MBID)).not.toThrow();
  });

  it('reads as no mark, and writes nothing, when the browser refuses its storage', () => {
    expect(hasRequested(refusedMarks, MBID)).toBe(false);
    expect(() => markRequested(refusedMarks, MBID)).not.toThrow();
    expect(() => unmarkRequested(refusedMarks, MBID)).not.toThrow();
  });
});
