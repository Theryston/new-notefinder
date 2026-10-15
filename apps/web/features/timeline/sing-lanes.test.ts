import { describe, expect, it } from 'vitest';

import { noteOn as sung } from '@/lib/note-fixtures';

import { MIN_SING_LANE_PX, singFocusKey, singLaneRange } from './sing-lanes';
import { laneCount } from './timeline-geometry';

const notes = [sung('C', 4, 0, 1), sung('D', 4, 2, 4), sung('E', 4, 5, 6)];
// C4 is 60.
const D4 = 62;

describe('singFocusKey', () => {
  it('is the note being sung', () => {
    expect(singFocusKey(notes, 3)).toBe(D4);
  });

  it('is the next note in a rest', () => {
    expect(singFocusKey(notes, 1.5)).toBe(D4);
    expect(singFocusKey(notes, -2)).toBe(60);
  });

  it('is the last note after the end', () => {
    expect(singFocusKey(notes, 9)).toBe(64);
  });

  it('is nothing for a Track without notes', () => {
    expect(singFocusKey([], 1)).toBeNull();
  });
});

describe('singLaneRange', () => {
  it('keeps the whole range when every lane can be labeled', () => {
    const range = { low: 58, high: 70 };
    expect(singLaneRange(range, 13 * MIN_SING_LANE_PX, 62)).toEqual(range);
  });

  it('shows a window of lanes, none thinner than the minimum, when the range is too wide', () => {
    const range = { low: 36, high: 84 };
    const height = 224;
    const shown = singLaneRange(range, height, 60);
    expect(height / laneCount(shown)).toBeGreaterThanOrEqual(MIN_SING_LANE_PX);
    expect(laneCount(shown)).toBe(Math.floor(height / MIN_SING_LANE_PX));
  });

  it('centers the window on the focus', () => {
    const shown = singLaneRange({ low: 36, high: 84 }, 12 * 11, 60);
    expect(shown).toEqual({ low: 55, high: 65 });
  });

  it('stays inside the Track’s range at either end', () => {
    const range = { low: 36, high: 84 };
    expect(singLaneRange(range, 120, 36).low).toBe(36);
    expect(singLaneRange(range, 120, 84).high).toBe(84);
  });

  it('centers on the range without a focus', () => {
    const shown = singLaneRange({ low: 36, high: 84 }, 12 * 11, null);
    expect(shown).toEqual({ low: 55, high: 65 });
  });

  it('always shows at least one lane', () => {
    expect(laneCount(singLaneRange({ low: 36, high: 84 }, 5, 60))).toBe(1);
  });

  describe('with the window it had before', () => {
    const range = { low: 36, high: 84 };
    const height = 12 * 11;
    const window = { low: 55, high: 65 };

    it('does not move while the focus stays inside it', () => {
      for (const focus of [57, 58, 60, 62, 63]) {
        expect(singLaneRange(range, height, focus, window)).toEqual(window);
      }
    });

    it('does not move on a run of notes inside the window', () => {
      let shown = window;
      for (const focus of [60, 62, 59, 63, 58, 61, 57]) {
        shown = singLaneRange(range, height, focus, shown);
      }
      expect(shown).toEqual(window);
    });

    it('moves, centered on the focus, when it comes within two lanes of an edge', () => {
      expect(singLaneRange(range, height, 64, window)).toEqual({
        low: 59,
        high: 69,
      });
      expect(singLaneRange(range, height, 56, window)).toEqual({
        low: 51,
        high: 61,
      });
    });

    it('moves when the focus left the window altogether', () => {
      expect(singLaneRange(range, height, 80, window)).toEqual({
        low: 74,
        high: 84,
      });
    });

    it('stays put without a focus', () => {
      expect(singLaneRange(range, height, null, window)).toEqual(window);
    });

    it('ignores a previous window that no longer fits (the box was resized)', () => {
      const shown = singLaneRange(range, 12 * 7, 60, window);
      expect(shown).toEqual({ low: 57, high: 63 });
    });
  });
});
