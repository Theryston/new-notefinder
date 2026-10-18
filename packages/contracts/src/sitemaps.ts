import { z } from 'zod';

import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from './auth-rules.js';
import { cursorPageSchema, cursorPaginationQuerySchema } from './pagination.js';

// The sitemap listings of Albums, Artists and Users: one cursor-paged list per
// type, shaped like the Tracks listing (`track-views.ts`, which aliases these
// schemas). Each lists the entities that have a public page, in ID order.

/** The most entries one sitemap page lists; a sitemap file holds thousands of URLs. */
export const SITEMAP_PAGE_SIZE = 5000;

/** The query of an entity sitemap listing. */
export const sitemapQuerySchema = cursorPaginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(SITEMAP_PAGE_SIZE).default(1000),
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

/**
 * One User in the Users sitemap. Its Profile URL is built from the Username,
 * so the entry carries it: the sitemap needs no lookup per User. The bounds
 * are the Username's, but not its pattern: legacy Usernames may not match it,
 * and a listing must still serve them.
 */
export const userSitemapEntrySchema = sitemapEntrySchema.extend({
  username: z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH),
  // The Avatar's absolute URL, when the User has one (Google's photo or an
  // uploaded one). Optional: the listing may leave it out.
  image: z.string().nullish(),
});

export type UserSitemapEntry = z.infer<typeof userSitemapEntrySchema>;

/** `GET /v1/sitemaps/users`: a page of Users who have a Username (a Profile). */
export const userSitemapPageSchema = cursorPageSchema(userSitemapEntrySchema);

export type UserSitemapPage = z.infer<typeof userSitemapPageSchema>;
