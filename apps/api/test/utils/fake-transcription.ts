import type { TranscriptionInput } from '../../src/integrations/elevenlabs/elevenlabs-transcription.client.js';
import type { Transcription } from '../../src/integrations/elevenlabs/scribe-output.js';

/**
 * What the fake Scribe answers by default: two words of one voice and three
 * more after a gap, as `scribe_v2` times them. Segments are empty, as the
 * parser always answers: lines come from words only.
 */
const FAKE_TRANSCRIPTION: Transcription = {
  segments: [],
  words: [
    { word: 'Is', start: 1.1, end: 1.3, speaker: 'speaker_0' },
    { word: 'this', start: 1.4, end: 1.8, speaker: 'speaker_0' },
    { word: 'the', start: 3.1, end: 3.3, speaker: 'speaker_0' },
    { word: 'real', start: 3.4, end: 3.8, speaker: 'speaker_0' },
    { word: 'life', start: 3.9, end: 4.3, speaker: 'speaker_0' },
  ],
};

/**
 * Scribe's transcription, faked at its integration boundary for the e2e specs.
 * Every call is recorded (the size of the audio), so a spec asserts what was
 * asked. A failure refuses every call, as Scribe does when it is down.
 */
export class FakeTranscription {
  /** The transcriptions asked for, in order. */
  readonly requests: { audioBytes: number }[] = [];
  /** What a transcription answers. */
  transcription: Transcription = FAKE_TRANSCRIPTION;
  /** When set, every call fails with it: Scribe is down. */
  requestFailure: Error | undefined;

  /** Back to the answers of a fresh fake, with no calls recorded. */
  reset(): void {
    this.requests.length = 0;
    this.transcription = FAKE_TRANSCRIPTION;
    this.requestFailure = undefined;
  }

  async transcribe(input: TranscriptionInput): Promise<Transcription> {
    this.requests.push({ audioBytes: input.audio.byteLength });
    if (this.requestFailure !== undefined) {
      throw this.requestFailure;
    }
    return this.transcription;
  }
}
