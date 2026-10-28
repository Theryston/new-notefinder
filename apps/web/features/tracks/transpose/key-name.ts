import { PITCH_CLASS_NAMES, type TrackKey } from '@vozzify/contracts';

import { transposeKey } from './transpose';

/** The tonic's name (`F#`) and the mode of a Track's key after a transposition. */
export function transposedKeyName(
  trackKey: TrackKey,
  semitones: number,
): { tonic: string; mode: TrackKey['mode'] } {
  const { tonic, mode } = transposeKey(trackKey, semitones);
  return { tonic: PITCH_CLASS_NAMES[tonic] ?? '', mode };
}
