import { z } from 'zod';

// The Processing of a Track: one run of the pipeline that turns its Recording
// into vocal notes and Timed lyrics (CONTEXT.md). The statuses, failure codes
// and steps are the full list the pipeline will use, so each later ticket only
// fills them in. Never rename one: add a new one instead.

/** The steps a Processing runs, in order, after it is queued. */
export const TRACK_PROCESSING_STEPS = [
  'FINDING_VIDEO',
  'DOWNLOADING_AUDIO',
  'EXTRACTING_VOCALS',
  'DETECTING_NOTES',
  'EXTRACTING_LYRICS',
] as const;

export const trackProcessingStepSchema = z.enum(TRACK_PROCESSING_STEPS);

export type TrackProcessingStep = z.infer<typeof trackProcessingStepSchema>;

/**
 * Where a Processing stands: queued, then one status per step, then the
 * terminal `COMPLETED` or `FAILED`.
 */
export const TRACK_PROCESSING_STATUSES = [
  'QUEUED',
  'FINDING_VIDEO',
  'DOWNLOADING_AUDIO',
  'EXTRACTING_VOCALS',
  'DETECTING_NOTES',
  'EXTRACTING_LYRICS',
  'COMPLETED',
  'FAILED',
] as const;

export const trackProcessingStatusSchema = z.enum(TRACK_PROCESSING_STATUSES);

export type TrackProcessingStatus = z.infer<typeof trackProcessingStatusSchema>;

/** The statuses a Processing never leaves. Clients stop polling on them. */
export const TRACK_PROCESSING_TERMINAL_STATUSES = [
  'COMPLETED',
  'FAILED',
] as const;

/** Whether a Processing in this status has nothing left to run. */
export const isTrackProcessingTerminal = (
  status: TrackProcessingStatus,
): boolean =>
  (TRACK_PROCESSING_TERMINAL_STATUSES as readonly string[]).includes(status);

/** Why a Processing failed. `VIDEO_NOT_FOUND` and `TOO_LONG` are final. */
export const TRACK_PROCESSING_FAILURE_CODES = [
  'VIDEO_NOT_FOUND',
  'TOO_LONG',
  'DOWNLOAD_FAILED',
  'NOTE_DETECTION_FAILED',
  'INTERNAL',
] as const;

export const trackProcessingFailureCodeSchema = z.enum(
  TRACK_PROCESSING_FAILURE_CODES,
);

export type TrackProcessingFailureCode = z.infer<
  typeof trackProcessingFailureCodeSchema
>;

/**
 * Where the chosen video came from: the Recording's own MusicBrainz link, or
 * the best YouTube Music search match.
 */
export const TRACK_PROCESSING_VIDEO_SOURCES = [
  'musicbrainz',
  'youtube_music',
] as const;

export const trackProcessingVideoSourceSchema = z.enum(
  TRACK_PROCESSING_VIDEO_SOURCES,
);

export type TrackProcessingVideoSource = z.infer<
  typeof trackProcessingVideoSourceSchema
>;

/** The YouTube video a Processing chose, and where it was found. */
export const trackProcessingVideoSchema = z.object({
  /** The YouTube video ID, the one the timeline will play. */
  id: z.string().min(1).max(64),
  source: trackProcessingVideoSourceSchema,
});

export type TrackProcessingVideo = z.infer<typeof trackProcessingVideoSchema>;

/** One Processing of a Track, as its latest read shows it. */
export const trackProcessingSchema = z.object({
  id: z.string().min(1).max(128),
  status: trackProcessingStatusSchema,
  /** Set on a `FAILED` Processing only. */
  failureCode: trackProcessingFailureCodeSchema.nullable(),
  /** Whether a retry can pick the Processing up (a failure that is not final). */
  retryable: z.boolean(),
  /** The step a retry starts at, once the Processing failed in one. */
  resumeFrom: trackProcessingStepSchema.nullable(),
  /** The video the Processing chose, once it has found one. */
  video: trackProcessingVideoSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  /** When the first step started; null while still queued. */
  startedAt: z.iso.datetime({ offset: true }).nullable(),
  /** When it completed or failed; null while it runs. */
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type TrackProcessing = z.infer<typeof trackProcessingSchema>;
