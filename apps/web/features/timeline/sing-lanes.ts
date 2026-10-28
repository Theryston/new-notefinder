import type { TrackNote } from '@vozzify/contracts';

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

/** Lanes of room the focus keeps from the edge of the window before it moves. */
const EDGE_MARGIN = 2;

function isUsable(previous: LaneRange, range: LaneRange, capacity: number) {
  return (
    laneCount(previous) === capacity &&
    previous.low >= range.low &&
    previous.high <= range.high
  );
}

/**
 * The lanes sing mode draws. A Track whose range is too wide for every lane
 * to be {@link MIN_SING_LANE_PX} tall shows a window of lanes instead of lanes
 * too thin to label. The window stays where it was (`previous`) while the
 * focus is more than {@link EDGE_MARGIN} lanes from its edges, so lanes and
 * labels do not jump on every note; when the focus gets close to an edge it
 * moves to center on the focus, inside the Track's range.
 */
export function singLaneRange(
  range: LaneRange,
  height: number,
  focus: number | null,
  previous?: LaneRange,
): LaneRange {
  const capacity = Math.max(1, Math.floor(height / MIN_SING_LANE_PX));
  if (laneCount(range) <= capacity) return range;
  if (previous && isUsable(previous, range, capacity)) {
    const margin = Math.min(EDGE_MARGIN, Math.floor((capacity - 1) / 2));
    if (
      focus === null ||
      (focus >= previous.low + margin && focus <= previous.high - margin)
    ) {
      return previous;
    }
  }
  const center = focus ?? Math.round((range.low + range.high) / 2);
  const low = Math.min(
    Math.max(Math.round(center - (capacity - 1) / 2), range.low),
    range.high - capacity + 1,
  );
  return { low, high: low + capacity - 1 };
}
