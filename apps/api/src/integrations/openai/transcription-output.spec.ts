import { transcriptionOf } from './transcription-output.js';

describe('transcriptionOf', () => {
  it('reads the segments and the words of a verbose_json answer', () => {
    const body = {
      task: 'transcribe',
      language: 'english',
      duration: 2.5,
      text: 'Is this the real life',
      segments: [{ id: 0, start: 0, end: 2.1, text: ' Is this the real life' }],
      words: [{ word: ' Is', start: 0.1, end: 0.3 }],
    };

    expect(transcriptionOf(body)).toEqual({
      segments: [{ start: 0, end: 2.1 }],
      words: [{ word: ' Is', start: 0.1, end: 0.3 }],
    });
  });

  it('reads an empty answer as no segments and no words', () => {
    expect(transcriptionOf({ text: '' })).toEqual({ segments: [], words: [] });
  });

  it('refuses an answer whose timestamps are not numbers', () => {
    expect(() =>
      transcriptionOf({ words: [{ word: 'Is', start: '0.1', end: 0.3 }] }),
    ).toThrow();
  });
});
