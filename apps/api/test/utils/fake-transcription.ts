import type { TranscriptionInput } from '../../src/integrations/openai/openai-transcription.client.js';
import type { Transcription } from '../../src/integrations/openai/transcription-output.js';

/**
 * What the fake OpenAI answers by default: two segments, the first with two
 * words and the second with three, as `whisper-1` times them.
 */
const FAKE_TRANSCRIPTION: Transcription = {
  segments: [
    { start: 1, end: 2.5 },
    { start: 3, end: 4.5 },
  ],
  words: [
    { word: ' Is', start: 1.1, end: 1.3 },
    { word: ' this', start: 1.4, end: 1.8 },
    { word: ' the', start: 3.1, end: 3.3 },
    { word: ' real', start: 3.4, end: 3.8 },
    { word: ' life', start: 3.9, end: 4.3 },
  ],
};

/**
 * OpenAI's transcription, faked at its integration boundary for the e2e specs.
 * Every call is recorded (the size of the audio and the Lyrics that guided it),
 * so a spec asserts what was asked. A failure refuses every call, as OpenAI does
 * when it is down.
 */
export class FakeTranscription {
  /** The transcriptions asked for, in order. */
  readonly requests: { audioBytes: number; lyrics: string | null }[] = [];
  /** What a transcription answers. */
  transcription: Transcription = FAKE_TRANSCRIPTION;
  /** When set, every call fails with it: OpenAI is down. */
  requestFailure: Error | undefined;

  /** Back to the answers of a fresh fake, with no calls recorded. */
  reset(): void {
    this.requests.length = 0;
    this.transcription = FAKE_TRANSCRIPTION;
    this.requestFailure = undefined;
  }

  async transcribe(input: TranscriptionInput): Promise<Transcription> {
    this.requests.push({
      audioBytes: input.audio.byteLength,
      lyrics: input.lyrics,
    });
    if (this.requestFailure !== undefined) {
      throw this.requestFailure;
    }
    return this.transcription;
  }
}
