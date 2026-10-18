import { z } from 'zod';

import { cursorPageSchema } from './pagination.js';
import {
  SITEMAP_PAGE_SIZE,
  sitemapEntrySchema,
  sitemapQuerySchema,
} from './sitemaps.js';

// Track views and the sitemap ordered by trending score. The sitemap schemas
// are the shared ones of `sitemaps.ts`; the Tracks names stay as aliases.

/**
 * `POST /v1/tracks/:trackId/views`. Without `viewId` a view is recorded; with
 * the ID a previous call returned, the signed-in User is attached to that
 * view instead (a visitor who signs in later in the same browser session).
 */
export const recordTrackViewBodySchema = z.object({
  viewId: z.string().min(1).max(128).optional(),
});

export type RecordTrackViewBody = z.infer<typeof recordTrackViewBodySchema>;

/** The view the call recorded or attached to; the browser keeps its ID. */
export const trackViewSchema = z.object({
  viewId: z.string().min(1).max(128),
});

export type TrackView = z.infer<typeof trackViewSchema>;

/** The most Tracks one sitemap page lists, and what the web's files ask for. */
export const TRACK_SITEMAP_PAGE_SIZE = SITEMAP_PAGE_SIZE;

/**
 * `GET /v1/sitemaps/tracks`: a page of completed Tracks, the highest trending
 * score first. `updatedAt` is the Track's last change (ISO 8601).
 */
export const listTrackSitemapQuerySchema = sitemapQuerySchema;

export type ListTrackSitemapQuery = z.infer<typeof listTrackSitemapQuerySchema>;

/**
 * A listed Track: its ID and last change, plus its cover in our own storage
 * (null until a Processing finds one) for the sitemap's image entry. Optional
 * on input so a listing without covers still parses.
 */
export const trackSitemapEntrySchema = sitemapEntrySchema.extend({
  coverUrl: z.string().min(1).max(2000).nullish(),
});

export type TrackSitemapEntry = z.infer<typeof trackSitemapEntrySchema>;

export const trackSitemapPageSchema = cursorPageSchema(trackSitemapEntrySchema);

export type TrackSitemapPage = z.infer<typeof trackSitemapPageSchema>;
