import { z } from 'zod';

import { catalogTrackArtistSchema } from './artists.js';
import { localeSchema } from './locales.js';
import { mbidSchema } from './music-catalog.js';
import { trackProcessingSchema } from './track-processing.js';

// The Track requests and the Processing state of a Track, as the public API
// speaks them (`POST /v1/tracks`, `GET /v1/tracks/:trackId/processing`).

/** Route param of the Track routes: a new ID or a legacy ID. */
export const trackIdParamSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type TrackIdParam = z.infer<typeof trackIdParamSchema>;

/**
 * `POST /v1/tracks`: asks for a Recording to become a Track. `locale` is the
 * language the User is browsing in, which the User keeps for their emails.
 */
export const createTrackBodySchema = z.object({
  recordingMbid: mbidSchema,
  locale: localeSchema,
});

export type CreateTrackBody = z.infer<typeof createTrackBodySchema>;

/** The Track the request resolved to, new or existing. */
export const createTrackResultSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type CreateTrackResult = z.infer<typeof createTrackResultSchema>;

/**
 * The Track header the Processing page shows. The cover is null until a
 * Processing finds one, and the artists are the Track's linked Artists (empty
 * until the metadata import has run).
 */
export const trackHeaderSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  coverUrl: z.string().min(1).max(2000).nullable(),
  artists: z.array(catalogTrackArtistSchema).max(30),
});

export type TrackHeader = z.infer<typeof trackHeaderSchema>;

/**
 * A User who did a Contribution to the Track. `username` is the link to their
 * Profile; `image` is their Avatar's URL, null without one.
 */
export const trackContributorSchema = z.object({
  username: z.string().min(1).max(100).nullable(),
  name: z.string().min(1).max(200),
  image: z.string().min(1).max(2000).nullable(),
});

export type TrackContributor = z.infer<typeof trackContributorSchema>;

/**
 * `GET /v1/tracks/:trackId/processing`: everything the Processing page shows.
 * `processing` is the latest Processing, or null for a Track that never had
 * one (only tracks imported without a pipeline run). Contributors come in the
 * order they first contributed.
 */
export const trackProcessingStateSchema = z.object({
  track: trackHeaderSchema,
  processing: trackProcessingSchema.nullable(),
  contributors: z.array(trackContributorSchema).max(100),
});

export type TrackProcessingState = z.infer<typeof trackProcessingStateSchema>;
