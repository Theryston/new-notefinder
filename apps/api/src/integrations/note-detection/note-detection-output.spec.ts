import { noteDetectionOutputOf } from './note-detection-output.js';

const validNote = { pitch: 70.08, start: 1.23, end: 1.61 };

const validOutput = {
  vocalsUrl: 'https://files.test/track-vocals/track-1/processing-1.wav',
  pitchCurveUrl:
    'https://files.test/track-pitch-curves/track-1/processing-1.bin',
  detectorVersion: 'note-detector@0123abc',
  notes: [validNote],
};

describe('noteDetectionOutputOf', () => {
  it('parses the vocals and Pitch curve URLs, the version and the notes of the worker output', () => {
    expect(noteDetectionOutputOf(validOutput)).toEqual(validOutput);
  });

  it('accepts a job that detected no notes', () => {
    expect(noteDetectionOutputOf({ ...validOutput, notes: [] }).notes).toEqual(
      [],
    );
  });

  it('keeps the continuous pitch of a note, fractional or below zero', () => {
    const output = {
      ...validOutput,
      notes: [{ ...validNote, pitch: -0.5 }],
    };

    expect(noteDetectionOutputOf(output).notes[0]?.pitch).toBe(-0.5);
  });

  it('refuses a note whose pitch is not a finite number', () => {
    const output = {
      ...validOutput,
      notes: [{ ...validNote, pitch: Number.POSITIVE_INFINITY }],
    };

    expect(() => noteDetectionOutputOf(output)).toThrow();
  });

  it('refuses a note without a pitch, such as one in the old note-name shape', () => {
    const output = {
      ...validOutput,
      notes: [{ note: 'A#', octave: 4, start: 1.23, end: 1.61 }],
    };

    expect(() => noteDetectionOutputOf(output)).toThrow();
  });

  it('refuses a note that starts before the music', () => {
    const output = {
      ...validOutput,
      notes: [{ ...validNote, start: -0.1 }],
    };

    expect(() => noteDetectionOutputOf(output)).toThrow();
  });

  it('refuses an output without a Pitch curve URL', () => {
    const { pitchCurveUrl: _omitted, ...output } = validOutput;

    expect(() => noteDetectionOutputOf(output)).toThrow();
  });

  it('refuses an output without a detector version', () => {
    expect(() =>
      noteDetectionOutputOf({ ...validOutput, detectorVersion: '' }),
    ).toThrow();
  });

  it('refuses an output without a vocals URL', () => {
    expect(() =>
      noteDetectionOutputOf({ ...validOutput, vocalsUrl: undefined }),
    ).toThrow();
  });

  it('refuses an output that is not an object, such as a worker error text', () => {
    expect(() => noteDetectionOutputOf('CUDA out of memory')).toThrow();
  });
});
