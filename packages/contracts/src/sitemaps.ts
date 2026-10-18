import { z } from 'zod';

import { cursorPageSchema, cursorPaginationQuerySchema } from './pagination.js';
import { TRACK_SITEMAP_PAGE_SIZE } from './track-views.js';

// The sitemap listings of Albums, Artists and Users: one cursor-paged list per
// type, shaped like the Tracks listing (`track-views.ts`). Each lists the
// entities that have a public page, in ID order.

/**
 * The query of an entity sitemap listing. A sitemap file holds thousands of
 * URLs, so its pages are as big as the Tracks' ones.
 */
export const sitemapQuerySchema = cursorPaginationQuerySchema.extend({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(TRACK_SITEMAP_PAGE_SIZE)
    .default(1000),
});

export type SitemapQuery = z.infer<typeof sitemapQuerySchema>;

/** One listed entity: its ID and its last change (ISO 8601). */
export const sitemapEntrySchema = z.object({
  id: z.string().min(1).max(128),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type SitemapEntry = z.infer<typeof sitemapEntrySchema>;

/** `GET /v1/sitemaps/albums`: a page of Albums with a completed Track. */
export const albumSitemapPageSchema = cursorPageSchema(sitemapEntrySchema);

export type AlbumSitemapPage = z.infer<typeof albumSitemapPageSchema>;

/** `GET /v1/sitemaps/artists`: a page of Artists with a completed Track. */
export const artistSitemapPageSchema = cursorPageSchema(sitemapEntrySchema);

export type ArtistSitemapPage = z.infer<typeof artistSitemapPageSchema>;

/** `GET /v1/sitemaps/users`: a page of Users who have a Username (a Profile). */
export const userSitemapPageSchema = cursorPageSchema(sitemapEntrySchema);

export type UserSitemapPage = z.infer<typeof userSitemapPageSchema>;
