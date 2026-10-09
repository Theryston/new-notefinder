import {
  TRACK_PROCESSING_FAILURE_CODES,
  TRACK_PROCESSING_STATUSES,
  TRACK_PROCESSING_STEPS,
  TRACK_PROCESSING_VIDEO_SOURCES,
} from '@notefinder/contracts';
import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';

export const trackProcessingStatus = pgEnum(
  'track_processing_status',
  TRACK_PROCESSING_STATUSES,
);

export const trackProcessingFailureCode = pgEnum(
  'track_processing_failure_code',
  TRACK_PROCESSING_FAILURE_CODES,
);

export const trackProcessingStep = pgEnum(
  'track_processing_step',
  TRACK_PROCESSING_STEPS,
);

export const trackProcessingVideoSource = pgEnum(
  'track_processing_video_source',
  TRACK_PROCESSING_VIDEO_SOURCES,
);

/**
 * One run of a Track's pipeline (CONTEXT.md "Processing"). The Track's state is
 * its latest Processing; a retry is a new row that starts at `resumeFrom` and
 * reuses the video and the files the failed one stored. Only the request
 * creates a row here, so later steps fill in the video, the URLs and the RunPod
 * job as they run.
 */
export const trackProcessings = pgTable(
  'track_processings',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    status: trackProcessingStatus().notNull().default('QUEUED'),
    // Set on a `FAILED` row only.
    failureCode: trackProcessingFailureCode(),
    // The step a retry starts at: the one that failed.
    resumeFrom: trackProcessingStep(),
    // The chosen YouTube video and where it was found.
    videoId: text(),
    videoSource: trackProcessingVideoSource(),
    // Our storage's public URLs of the audio and the vocals, in WAV and MP3.
    musicWavUrl: text(),
    musicMp3Url: text(),
    vocalsWavUrl: text(),
    vocalsMp3Url: text(),
    // The RunPod job of the note detection, to poll its `/status`.
    runpodJobId: text(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    // Set once the Contributors were emailed about the end, so they are emailed once.
    contributorsNotifiedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // The latest Processing of a Track is the newest row of its Track.
    index().on(table.trackId, table.createdAt),
    // "Active Processings per User" joins a User's Contributions to the
    // Processings that have not ended. Only those rows are indexed, so the
    // join stays small however many Processings have completed.
    index('track_processings_active_index')
      .on(table.id)
      .where(sql`${table.status} not in ('COMPLETED', 'FAILED')`),
  ],
);
