import type { TrackNote } from '@notefinder/contracts';

import { keyOf } from '@/lib/music-notes';

import { type LaneRange, laneCount } from './timeline-geometry';

/**
 * The thinnest a lane may be in sing mode. Every lane is labeled with its
 * note there, and a 10px label needs this much room to be read.
 */
export const MIN_SING_LANE_PX = 12;

/**
 * The key the roll should keep in view at `now`: the note being sung, else the
 * next one, else the last one. Notes are in sung order, so a binary search
 * finds the first note that has not ended yet.
 */
export function singFocusKey(
  notes: readonly TrackNote[],
  now: number,
): number | null {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    const note = notes[middle];
    if (note && note.end > now) high = middle;
    else low = middle + 1;
  }
  const focus = notes[low] ?? notes.at(-1);
  return focus ? keyOf(focus) : null;
}

/**
 * The lanes sing mode draws. A Track whose range is too wide for every lane
 * to be {@link MIN_SING_LANE_PX} tall shows a window of lanes around `focus`
 * (kept inside the Track's range) instead of lanes too thin to label.
 */
export function singLaneRange(
  range: LaneRange,
  height: number,
  focus: number | null,
): LaneRange {
  const capacity = Math.max(1, Math.floor(height / MIN_SING_LANE_PX));
  if (laneCount(range) <= capacity) return range;
  const center = focus ?? Math.round((range.low + range.high) / 2);
  const low = Math.min(
    Math.max(Math.round(center - (capacity - 1) / 2), range.low),
    range.high - capacity + 1,
  );
  return { low, high: low + capacity - 1 };
}
