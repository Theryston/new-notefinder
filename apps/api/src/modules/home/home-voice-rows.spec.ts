import {
  EASY_START_MAX_SPAN,
  HIGHER_VOICE_MIN_MIDPOINT,
  LOWER_VOICE_MAX_MIDPOINT,
  VOICE_ROW_KINDS,
  voiceRowMatches,
} from './home-voice-rows.js';

// MIDI numbers: C4 is 60, A4 is 69.
const range = (lowest: number, highest: number) => ({ lowest, highest });

describe('voiceRowMatches', () => {
  it('takes a range of at most the easy-start span as easy to start', () => {
    expect(
      voiceRowMatches('easy-start', range(60, 60 + EASY_START_MAX_SPAN)),
    ).toBe(true);
  });

  it('refuses a range one semitone wider than the easy-start span', () => {
    expect(
      voiceRowMatches('easy-start', range(60, 61 + EASY_START_MAX_SPAN)),
    ).toBe(false);
  });

  it('takes a range whose midpoint is at the higher-voices line', () => {
    const lowest = HIGHER_VOICE_MIN_MIDPOINT - 6;
    expect(voiceRowMatches('higher-voices', range(lowest, lowest + 12))).toBe(
      true,
    );
  });

  it('refuses a range whose midpoint sits just below the higher-voices line', () => {
    const lowest = HIGHER_VOICE_MIN_MIDPOINT - 7;
    expect(voiceRowMatches('higher-voices', range(lowest, lowest + 12))).toBe(
      false,
    );
  });

  it('takes a range whose midpoint is at the lower-voices line', () => {
    const highest = LOWER_VOICE_MAX_MIDPOINT + 6;
    expect(voiceRowMatches('lower-voices', range(highest - 12, highest))).toBe(
      true,
    );
  });

  it('refuses a range whose midpoint sits just above the lower-voices line', () => {
    const highest = LOWER_VOICE_MAX_MIDPOINT + 7;
    expect(voiceRowMatches('lower-voices', range(highest - 12, highest))).toBe(
      false,
    );
  });

  it('never puts a range in both the higher and the lower voices rows', () => {
    const everyRange = [];
    for (let lowest = 30; lowest <= 90; lowest += 1) {
      for (let span = 0; span <= 24; span += 1) {
        everyRange.push(range(lowest, lowest + span));
      }
    }
    for (const candidate of everyRange) {
      expect(
        voiceRowMatches('higher-voices', candidate) &&
          voiceRowMatches('lower-voices', candidate),
      ).toBe(false);
    }
  });

  it('gives a narrow range in the middle both the easy-start row and no voice row', () => {
    const middle = range(55, 60);
    expect(voiceRowMatches('easy-start', middle)).toBe(true);
    expect(voiceRowMatches('higher-voices', middle)).toBe(false);
    expect(voiceRowMatches('lower-voices', middle)).toBe(false);
  });

  it('knows exactly the three by-voice rows', () => {
    expect(VOICE_ROW_KINDS).toEqual([
      'easy-start',
      'higher-voices',
      'lower-voices',
    ]);
  });
});
