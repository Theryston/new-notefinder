import { z } from 'zod';

// What OpenAI answers to a `verbose_json` transcription with segment and word
// timestamps (`whisper-1`). Only the timing is read: the text of a segment is
// never used, the words are. Missing lists are empty, so an answer with nothing
// to transcribe reads as no lines.

const segmentSchema = z.object({
  /** Seconds from the start of the audio. */
  start: z.number(),
  end: z.number(),
});

const wordSchema = z.object({
  /** The word as sung, with the blank before it (" Is"). */
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

const transcriptionSchema = z.object({
  segments: z.array(segmentSchema).default([]),
  words: z.array(wordSchema).default([]),
});

export type Transcription = z.infer<typeof transcriptionSchema>;

/** A transcription answer, parsed. Anything else is a broken answer. */
export const transcriptionOf = (body: unknown): Transcription =>
  transcriptionSchema.parse(body);
