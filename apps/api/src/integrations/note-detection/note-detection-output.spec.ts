import { noteDetectionOutputOf } from './note-detection-output.js';

const validNote = {
  note: 'A#',
  octave: 4,
  start: 1.23,
  end: 1.61,
  frequencyMean: 468.2,
};

const validOutput = {
  vocalsUrl: 'https://files.test/track-vocals/track-1/processing-1.wav',
  notes: [validNote],
};

describe('noteDetectionOutputOf', () => {
  it('parses the vocals URL and the notes of the worker output', () => {
    expect(noteDetectionOutputOf(validOutput)).toEqual(validOutput);
  });

  it('accepts a job that detected no notes', () => {
    expect(noteDetectionOutputOf({ ...validOutput, notes: [] }).notes).toEqual(
      [],
    );
  });

  it('refuses a note name that is not one of the twelve pitch classes', () => {
    const output = {
      ...validOutput,
      notes: [{ ...validNote, note: 'H' }],
    };

    expect(() => noteDetectionOutputOf(output)).toThrow();
  });

  it('refuses a note with a fractional octave', () => {
    const output = {
      ...validOutput,
      notes: [{ ...validNote, octave: 4.5 }],
    };

    expect(() => noteDetectionOutputOf(output)).toThrow();
  });

  it('refuses a note with a frequency that is not positive', () => {
    const output = {
      ...validOutput,
      notes: [{ ...validNote, frequencyMean: 0 }],
    };

    expect(() => noteDetectionOutputOf(output)).toThrow();
  });

  it('refuses an output without a vocals URL', () => {
    expect(() => noteDetectionOutputOf({ notes: validOutput.notes })).toThrow();
  });

  it('refuses an output that is not an object, such as a worker error text', () => {
    expect(() => noteDetectionOutputOf('CUDA out of memory')).toThrow();
  });
});
