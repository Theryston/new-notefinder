import { transcriptionOf } from './scribe-output.js';

describe('transcriptionOf', () => {
  it('reads the words of a Scribe v2 answer with their voices, skipping spacing and audio events', () => {
    const body = {
      language_code: 'eng',
      language_probability: 0.98,
      text: 'Is this (laughter)',
      words: [
        {
          text: 'Is',
          start: 0.1,
          end: 0.3,
          type: 'word',
          speaker_id: 'speaker_0',
          logprob: -0.1,
        },
        {
          text: ' ',
          start: 0.3,
          end: 0.35,
          type: 'spacing',
          speaker_id: 'speaker_0',
          logprob: 0,
        },
        {
          text: 'this',
          start: 0.35,
          end: 0.6,
          type: 'word',
          speaker_id: 'speaker_1',
          logprob: -0.2,
        },
        {
          text: '(laughter)',
          start: 0.6,
          end: 0.9,
          type: 'audio_event',
          speaker_id: null,
          logprob: -1,
        },
      ],
    };

    expect(transcriptionOf(body)).toEqual({
      segments: [],
      words: [
        { word: 'Is', start: 0.1, end: 0.3, speaker: 'speaker_0' },
        { word: 'this', start: 0.35, end: 0.6, speaker: 'speaker_1' },
      ],
    });
  });

  it('reads a word without a diarized voice as a word without one', () => {
    expect(
      transcriptionOf({
        words: [{ text: 'Is', start: 0.1, end: 0.3, type: 'word' }],
      }),
    ).toEqual({
      segments: [],
      words: [{ word: 'Is', start: 0.1, end: 0.3 }],
    });
  });

  it('reads a word whose voice is null as a word without one', () => {
    expect(
      transcriptionOf({
        words: [
          {
            text: 'Is',
            start: 0.1,
            end: 0.3,
            type: 'word',
            speaker_id: null,
          },
        ],
      }),
    ).toEqual({
      segments: [],
      words: [{ word: 'Is', start: 0.1, end: 0.3 }],
    });
  });

  it('reads an empty answer as no words', () => {
    expect(transcriptionOf({})).toEqual({ segments: [], words: [] });
  });

  it('refuses an answer whose timestamps are not numbers', () => {
    expect(() =>
      transcriptionOf({
        words: [{ text: 'Is', start: '0.1', end: 0.3, type: 'word' }],
      }),
    ).toThrow();
  });
});
