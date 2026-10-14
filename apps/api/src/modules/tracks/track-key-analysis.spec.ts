import { describe, expect, it } from 'vitest';
import { analyzeTrackNotes } from './track-key-analysis.js';

describe('analyzeTrackNotes', () => {
  it('finds the duration-weighted vocal range and Krumhansl-Schmuckler key', () => {
    const profile = [
      6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
    ];
    const notes = profile.map((duration, pitchClass) => ({
      pitch: 60 + pitchClass,
      start: 0,
      end: duration,
    }));

    expect(analyzeTrackNotes(notes)).toEqual({
      vocalRange: { lowMidi: 60, highMidi: 71 },
      estimatedKey: { tonic: 0, mode: 'MAJOR' },
    });
  });

  it('leaves the key undefined for notes with no duration and clears metadata for no notes', () => {
    expect(analyzeTrackNotes([{ pitch: 60, start: 1, end: 1 }])).toEqual({
      vocalRange: { lowMidi: 60, highMidi: 60 },
      estimatedKey: null,
    });
    expect(analyzeTrackNotes([])).toEqual({
      vocalRange: null,
      estimatedKey: null,
    });
  });
});
