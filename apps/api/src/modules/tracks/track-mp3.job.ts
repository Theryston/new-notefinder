import { z } from 'zod';

// The music MP3 of a Processing is a job of its own, on a queue of its own
// (ADR 0004): a conversion or storage failure is retried by BullMQ and, on its
// last attempt, logged. The lyrics never wait for it, and it never waits for
// the lyrics.

export const TRACK_MP3_QUEUE = 'track-mp3';
export const STORE_MUSIC_MP3_JOB = 'store-music-mp3';

export const storeMusicMp3JobSchema = z.object({
  trackId: z.string().min(1).max(128),
  processingId: z.string().min(1).max(128),
});

export type StoreMusicMp3Job = z.infer<typeof storeMusicMp3JobSchema>;

/** Keyed by the Processing, so queuing it again while the first job is kept does nothing. */
export const musicMp3JobId = (processingId: string) =>
  `music-mp3-${processingId}`;
