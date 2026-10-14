import { z } from 'zod';

// What the worker returns when its job completes (apps/note-detector, its
// contract.py and handler): the public URLs of the vocals and the Pitch curve
// it uploaded, the version that produced them and the Vocal notes it
// detected, in time order. The fields are camelCase on the wire.

const detectedNoteSchema = z.object({
  /** The continuous MIDI pitch (A4 is 69). */
  pitch: z.number(),
  /** Seconds from the start of the vocals. */
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});

const noteDetectionOutputSchema = z.object({
  vocalsUrl: z.url(),
  pitchCurveUrl: z.url(),
  /** `note-detector@<git sha>`: which code and models made the notes. */
  detectorVersion: z.string().min(1),
  notes: z.array(detectedNoteSchema),
});

export type NoteDetectionOutput = z.infer<typeof noteDetectionOutputSchema>;

/** A completed job's output, parsed. Anything else is a broken worker. */
export const noteDetectionOutputOf = (body: unknown): NoteDetectionOutput =>
  noteDetectionOutputSchema.parse(body);
