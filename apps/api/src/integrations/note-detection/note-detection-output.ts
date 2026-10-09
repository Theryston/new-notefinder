import { z } from 'zod';

// What the worker returns when its job completes (apps/nfp-audio, its
// handler.py): the public URL of the vocals it uploaded and the notes it
// detected, in time order. The fields are camelCase on the wire.

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

const detectedNoteSchema = z.object({
  note: z.enum(NOTE_NAMES),
  /** The octave in MIDI numbering (`A4` is 4). */
  octave: z.int(),
  /** Seconds from the start of the vocals. */
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  /** The mean frequency of the note, in Hz. */
  frequencyMean: z.number().positive(),
});

const noteDetectionOutputSchema = z.object({
  vocalsUrl: z.url(),
  notes: z.array(detectedNoteSchema),
});

export type NoteDetectionOutput = z.infer<typeof noteDetectionOutputSchema>;

/** One note the worker detected. */
export type DetectedNote = NoteDetectionOutput['notes'][number];

/** A completed job's output, parsed. Anything else is a broken worker. */
export const noteDetectionOutputOf = (body: unknown): NoteDetectionOutput =>
  noteDetectionOutputSchema.parse(body);
