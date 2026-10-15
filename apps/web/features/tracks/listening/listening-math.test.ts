import { describe, expect, it } from 'vitest';

import { loopRange, moveLoopHandle, nextNotesTarget } from './listening-math';

describe('skipping silence before the next notes', () => {
  const notes = [{ pitch: 60, start: 20, end: 22 }];
  it('offers a seek one second before a note at least ten seconds away', () => {
    expect(nextNotesTarget(notes, 10)).toBe(19);
    expect(nextNotesTarget(notes, 10.01)).toBeNull();
    expect(nextNotesTarget(notes, 20)).toBeNull();
    expect(nextNotesTarget(notes, 23)).toBeNull();
  });
});

describe('loop range', () => {
  it('clamps handles without crossing and preserves a short line', () => {
    expect(moveLoopHandle({ start: 10, end: 20 }, 'start', 25, 30)).toEqual({
      start: 19.9,
      end: 20,
    });
    expect(moveLoopHandle({ start: 10, end: 20 }, 'end', -5, 30)).toEqual({
      start: 10,
      end: 10.1,
    });
    expect(moveLoopHandle({ start: 0, end: 5 }, 'end', 100, 30)).toEqual({
      start: 0,
      end: 30,
    });
    expect(loopRange(29, 50, 30)).toEqual({ start: 29, end: 30 });
    expect(loopRange(0, 0, 0)).toBeNull();
  });
});
