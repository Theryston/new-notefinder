import { z } from 'zod';
import { clickIdSchema, visitorIdSchema } from './events.js';
import { localeSchema } from './locales.js';
import { cursorPageSchema } from './pagination.js';
import {
  SITEMAP_PAGE_SIZE,
  sitemapEntrySchema,
  sitemapQuerySchema,
} from './sitemaps.js';
import { trackCoverUrlSchema } from './tracks.js';

// Track views and the sitemap ordered by trending score. The paging and entry
// shapes of the sitemap come from the shared `sitemaps.ts`; the Track entry
// adds its cover on top of them.

/**
 * `POST /v1/tracks/:trackId/views`. Without `viewId` a view is recorded; with
 * the ID a previous call returned, the signed-in User is attached to that
 * view instead (a visitor who signs in later in the same browser session).
 * `locale` is the language the page was displayed in; it is stored with a new
 * view and left alone when attaching. Omitted, the view has no locale.
 */
export const recordTrackViewBodySchema = z.object({
  viewId: z.string().min(1).max(128).optional(),
  clickId: clickIdSchema.optional(),
  visitorId: visitorIdSchema.optional(),
  locale: localeSchema.optional(),
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
 * for the sitemap's image entry (null until a Processing finds one). The cover
 * is `nullish` because the web may deploy before the API that sends it, so a
 * listing without the field still parses; the API always sends it.
 */
export const trackSitemapEntrySchema = sitemapEntrySchema.extend({
  coverUrl: trackCoverUrlSchema.nullish(),
});

export type TrackSitemapEntry = z.infer<typeof trackSitemapEntrySchema>;

export const trackSitemapPageSchema = cursorPageSchema(trackSitemapEntrySchema);

export type TrackSitemapPage = z.infer<typeof trackSitemapPageSchema>;
