import { PITCH_CLASS_NAMES, type TrackNote } from '@vozzify/contracts';

/** A note on the key of this name and octave (`C#`, 3), for test fixtures. */
export function noteOn(
  name: (typeof PITCH_CLASS_NAMES)[number],
  octave: number,
  start = 0,
  end = 1,
): TrackNote {
  return {
    pitch: (octave + 1) * 12 + PITCH_CLASS_NAMES.indexOf(name),
    start,
    end,
  };
}
