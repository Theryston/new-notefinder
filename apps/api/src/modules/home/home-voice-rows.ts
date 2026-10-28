import type { TrackVocalRange } from '@vozzify/contracts';

/**
 * The by-voice rows: which Tracks suit which voice, judged from the Track's
 * stored Vocal range. Ranges are MIDI numbers (C4 is 60). A range can match
 * the easy-start row and one of the two voice rows, never both voice rows.
 */

/** A range this narrow (a sixth, in semitones) is easy to start singing. */
export const EASY_START_MAX_SPAN = 9;

/** A midpoint at or above E4 is a song for higher voices. */
export const HIGHER_VOICE_MIN_MIDPOINT = 64;

/** A midpoint at or below F3 is a song for lower voices. */
export const LOWER_VOICE_MAX_MIDPOINT = 53;

export const VOICE_ROW_KINDS = [
  'easy-start',
  'higher-voices',
  'lower-voices',
] as const;

export type VoiceRowKind = (typeof VOICE_ROW_KINDS)[number];

const midpointOf = ({ lowest, highest }: TrackVocalRange): number =>
  (lowest + highest) / 2;

const VOICE_ROW_RULES: Record<
  VoiceRowKind,
  (range: TrackVocalRange) => boolean
> = {
  'easy-start': ({ lowest, highest }) =>
    highest - lowest <= EASY_START_MAX_SPAN,
  'higher-voices': (range) => midpointOf(range) >= HIGHER_VOICE_MIN_MIDPOINT,
  'lower-voices': (range) => midpointOf(range) <= LOWER_VOICE_MAX_MIDPOINT,
};

/** Whether a Track with this Vocal range belongs in the row of `kind`. */
export const voiceRowMatches = (
  kind: VoiceRowKind,
  range: TrackVocalRange,
): boolean => VOICE_ROW_RULES[kind](range);
