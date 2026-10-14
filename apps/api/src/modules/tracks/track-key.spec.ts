import { estimateKey } from './track-key.js';

/** Notes of one second each, one after the other, for these MIDI pitches. */
const sung = (...pitches: number[]) =>
  pitches.map((pitch, index) => ({ pitch, start: index, end: index + 1 }));

describe('estimateKey', () => {
  it('finds a major key from its scale', () => {
    // G major: G A B C D E F#
    expect(estimateKey(sung(67, 69, 71, 72, 74, 76, 78, 67, 67, 74))).toEqual({
      tonic: 7,
      mode: 'MAJOR',
    });
  });

  it('finds a minor key from its scale', () => {
    // A minor: A B C D E F G, leaning on the tonic and the fifth
    expect(
      estimateKey(sung(57, 59, 60, 62, 64, 65, 67, 57, 57, 64, 64, 57)),
    ).toEqual({ tonic: 9, mode: 'MINOR' });
  });

  it('weighs a pitch class by how long it is held, not by how many notes', () => {
    // Many short C# notes against a few long notes of a D major triad.
    const notes = [
      ...Array.from({ length: 6 }, (_, index) => ({
        pitch: 61,
        start: index * 0.1,
        end: index * 0.1 + 0.05,
      })),
      { pitch: 62, start: 10, end: 20 },
      { pitch: 66, start: 20, end: 24 },
      { pitch: 69, start: 24, end: 29 },
      { pitch: 62, start: 29, end: 35 },
    ];

    expect(estimateKey(notes)).toEqual({ tonic: 2, mode: 'MAJOR' });
  });

  it('puts the same notes in another octave in the same key', () => {
    const notes = sung(67, 69, 71, 72, 74, 76, 78, 67, 67, 74);

    expect(
      estimateKey(notes.map((note) => ({ ...note, pitch: note.pitch - 24 }))),
    ).toEqual(estimateKey(notes));
  });

  it('counts a pitch between two keys for the nearest one', () => {
    expect(estimateKey(sung(66.6, 66.6, 69))).toEqual(
      estimateKey(sung(67, 67, 69)),
    );
  });

  it('has no key without sound', () => {
    expect(estimateKey([])).toBeNull();
    expect(estimateKey([{ pitch: 60, start: 3, end: 3 }])).toBeNull();
  });
});
