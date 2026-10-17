import {
  ElevenLabsTranscriptionClient,
  type ScribeConvert,
} from './elevenlabs-transcription.client.js';

const AUDIO: Uint8Array<ArrayBuffer> = new Uint8Array([73, 68, 51, 4]);

/** What Scribe v2 answers to the vocals: a word, a spacing and an event. */
const scribeAnswer = () => ({
  language_code: 'eng',
  language_probability: 0.98,
  text: 'Is this',
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
      speaker_id: 'speaker_0',
      logprob: -0.2,
    },
  ],
});

describe('ElevenLabsTranscriptionClient', () => {
  const convert = vi.fn<ScribeConvert>();

  beforeEach(() => {
    convert.mockReset();
  });

  it('asks Scribe v2 for word timestamps with diarization, and nothing else', async () => {
    convert.mockResolvedValue(scribeAnswer());

    await new ElevenLabsTranscriptionClient(
      'elevenlabs-key',
      convert,
    ).transcribe({ audio: AUDIO });

    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith(
      {
        file: AUDIO,
        modelId: 'scribe_v2',
        timestampsGranularity: 'word',
        diarize: true,
        tagAudioEvents: false,
        noVerbatim: false,
      },
      { timeoutInSeconds: 300 },
    );
  });

  it('answers the timed words of what Scribe sent back', async () => {
    convert.mockResolvedValue(scribeAnswer());

    await expect(
      new ElevenLabsTranscriptionClient('elevenlabs-key', convert).transcribe({
        audio: AUDIO,
      }),
    ).resolves.toEqual({
      segments: [],
      words: [
        { word: 'Is', start: 0.1, end: 0.3, speaker: 'speaker_0' },
        { word: 'this', start: 0.35, end: 0.6, speaker: 'speaker_0' },
      ],
    });
  });

  it('lets a refused transcription throw, without a transcription', async () => {
    convert.mockRejectedValue(new Error('ElevenLabs is down'));

    await expect(
      new ElevenLabsTranscriptionClient('elevenlabs-key', convert).transcribe({
        audio: AUDIO,
      }),
    ).rejects.toThrow('ElevenLabs is down');
  });

  it('fails without calling Scribe when no key is set', async () => {
    await expect(
      new ElevenLabsTranscriptionClient(undefined, convert).transcribe({
        audio: AUDIO,
      }),
    ).rejects.toThrow('ELEVENLABS_API_KEY is not set');

    expect(convert).not.toHaveBeenCalled();
  });
});
