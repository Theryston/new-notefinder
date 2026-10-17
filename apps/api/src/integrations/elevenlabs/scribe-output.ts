import { z } from 'zod';

// What Scribe v2 answers to a batch transcription with word timestamps. Only
// the words are read: provider segments are ignored (the lines are built from
// word timestamps only), spacing tokens carry no sung text, and audio events
// are not sung words. A missing word list is an answer with nothing to
// transcribe, so it reads as no words; anything else mistimed is a broken
// answer.

const scribeWordSchema = z.object({
  /** The word or sound that was transcribed. */
  text: z.string(),
  /** `word`, `spacing` or `audio_event`: only words are sung. */
  type: z.string(),
  /** Seconds from the start of the audio. */
  start: z.number(),
  end: z.number(),
  /** The diarized voice, absent when the answer carries none. */
  speaker_id: z.string().nullish(),
});

const scribeAnswerSchema = z.object({
  words: z.array(scribeWordSchema).default([]),
});

type ScribeWord = z.infer<typeof scribeWordSchema>;

/** One transcribed word with its timing, plus its voice when diarized. */
type TranscriptionWord = {
  word: string;
  start: number;
  end: number;
  speaker?: string;
};

export type Transcription = {
  /**
   * Unread by the lines: Scribe answers carry no segments (lines come from
   * words only), so the parser answers none. Callers keep passing the whole
   * transcription.
   */
  segments: { start: number; end: number }[];
  words: TranscriptionWord[];
};

/** A transcribed word with its voice; a voiceless word stays voiceless. */
const wordOf = ({
  text,
  start,
  end,
  speaker_id: speakerId,
}: ScribeWord): TranscriptionWord =>
  speakerId === null || speakerId === undefined
    ? { word: text, start, end }
    : { word: text, start, end, speaker: speakerId };

/** A Scribe answer, parsed. Anything else is a broken answer. */
export const transcriptionOf = (body: unknown): Transcription => {
  const answer = scribeAnswerSchema.parse(body);
  return {
    segments: [],
    words: answer.words.flatMap((item) =>
      item.type === 'word' ? [wordOf(item)] : [],
    ),
  };
};
