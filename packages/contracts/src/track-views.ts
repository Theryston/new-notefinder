import { z } from 'zod';

import { cursorPageSchema, cursorPaginationQuerySchema } from './pagination.js';

// Track views and the sitemap ordered by trending score.

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

/**
 * `GET /v1/sitemaps/tracks`: a page of completed Tracks, the highest trending
 * score first. `updatedAt` is the Track's last change (ISO 8601).
 */
export const listTrackSitemapQuerySchema = cursorPaginationQuerySchema.extend({
  // A sitemap file holds thousands of URLs, so its pages are bigger than a
  // list's.
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

export type ListTrackSitemapQuery = z.infer<typeof listTrackSitemapQuerySchema>;

export const trackSitemapEntrySchema = z.object({
  id: z.string().min(1).max(128),
  updatedAt: z.string().min(1).max(40),
});

export type TrackSitemapEntry = z.infer<typeof trackSitemapEntrySchema>;

export const trackSitemapPageSchema = cursorPageSchema(trackSitemapEntrySchema);

export type TrackSitemapPage = z.infer<typeof trackSitemapPageSchema>;
