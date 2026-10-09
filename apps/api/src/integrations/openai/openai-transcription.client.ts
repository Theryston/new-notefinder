import { type Transcription, transcriptionOf } from './transcription-output.js';
import { whisperPromptOf } from './whisper-prompt.js';

// OpenAI's transcription endpoint: the only code that calls it. Features depend
// on this class, so tests replace it at this boundary.
const OPENAI_TRANSCRIPTIONS_URL =
  'https://api.openai.com/v1/audio/transcriptions';

// A full song transcribes well within this; a hung request is cut here instead
// of holding the Processing's lyrics step open.
const REQUEST_TIMEOUT_MS = 5 * 60_000;

/** One transcription: the vocals as MP3, and the Recording's Lyrics if it has them. */
export type TranscriptionInput = {
  audio: Uint8Array<ArrayBuffer>;
  /** The Recording's plain Lyrics, which guide the words; null when there are none. */
  lyrics: string | null;
};

/**
 * Transcribes a Processing's vocals with OpenAI's `whisper-1` (ADR 0004), asking
 * for segment and word timestamps.
 */
export class OpenAiTranscriptionClient {
  constructor(private readonly apiKey: string | undefined) {}

  async transcribe(input: TranscriptionInput): Promise<Transcription> {
    const apiKey = this.configuredKey();
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: formOf(input),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return transcriptionOf(await readJson(response));
  }

  private configuredKey(): string {
    if (this.apiKey === undefined) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    return this.apiKey;
  }
}

/**
 * The multipart form OpenAI reads. Both granularities are asked for: the
 * segments make the lines, the words make their timing.
 */
const formOf = ({ audio, lyrics }: TranscriptionInput): FormData => {
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'vocals.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  form.append('timestamp_granularities[]', 'word');
  const prompt = whisperPromptOf(lyrics);
  if (prompt !== undefined) {
    form.append('prompt', prompt);
  }
  return form;
};

/** The JSON body of a successful answer; any other status is an error. */
const readJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`OpenAI answered HTTP ${response.status}`);
  }
  return response.json();
};
