import { z } from 'zod';
import { localeSchema } from './locales.js';
import { trackHeaderSchema, trackVocalRangeSchema } from './tracks.js';

/**
 * The home feed (`GET /v1/home`): an ordered list of rows. Clients render the
 * layouts they know and ignore the others (a row whose `layout` fails the
 * discriminated union is skipped), so a newer API never breaks an older app.
 */

/**
 * A Track as a home card: its header (id, title, cover, artist credit) plus
 * what a card adds: the length and the vocal range, which show its difficulty.
 */
export const homeTrackSchema = trackHeaderSchema.extend({
  durationMs: z.number().int().nonnegative().nullable(),
  vocalRange: trackVocalRangeSchema.nullable(),
});

export type HomeTrack = z.infer<typeof homeTrackSchema>;

/**
 * A row title is a translation key plus its parameters, never translated text:
 * the web translates it with its own locale files.
 */
export const homeRowTitleSchema = z.object({
  key: z.string().min(1).max(128),
  params: z.record(z.string(), z.union([z.string().max(200), z.number()])),
});

export type HomeRowTitle = z.infer<typeof homeRowTitleSchema>;

const homeRowIdSchema = z.string().min(1).max(64);

/**
 * The `sponsored` flag is absent or false on every algorithmic row. When it is
 * true, clients show the sponsored-content notice on the row.
 */
export const homeHeroSchema = z.object({
  id: homeRowIdSchema,
  layout: z.literal('hero'),
  sponsored: z.boolean().optional(),
  track: homeTrackSchema,
});

export type HomeHero = z.infer<typeof homeHeroSchema>;

export const HOME_CAROUSEL_MAX_ITEMS = 24;

export const homeCarouselRowSchema = z.object({
  id: homeRowIdSchema,
  layout: z.literal('standard'),
  title: homeRowTitleSchema,
  sponsored: z.boolean().optional(),
  items: z.array(homeTrackSchema).min(1).max(HOME_CAROUSEL_MAX_ITEMS),
});

export type HomeCarouselRow = z.infer<typeof homeCarouselRowSchema>;

/**
 * A carousel of by-voice Tracks: each card also shows the Track's Vocal range
 * as a bar. Every item carries a range, since the row exists to show it.
 */
export const homeVocalRangeTrackSchema = homeTrackSchema.extend({
  vocalRange: trackVocalRangeSchema,
});

export type HomeVocalRangeTrack = z.infer<typeof homeVocalRangeTrackSchema>;

export const homeVocalRangeRowSchema = homeCarouselRowSchema.extend({
  layout: z.literal('vocal-range'),
  items: z.array(homeVocalRangeTrackSchema).min(1).max(HOME_CAROUSEL_MAX_ITEMS),
});

export type HomeVocalRangeRow = z.infer<typeof homeVocalRangeRowSchema>;

export const homeRowSchema = z.discriminatedUnion('layout', [
  homeHeroSchema,
  homeCarouselRowSchema,
  homeVocalRangeRowSchema,
]);

export type HomeRow = z.infer<typeof homeRowSchema>;

export const HOME_FEED_MAX_ROWS = 24;

/**
 * One page of the home feed. `version` identifies the content of the feed the
 * rows come from, and `nextCursor` (null on the last page) resumes the same
 * version, so paging never repeats or skips rows across a regeneration.
 */
export const homeFeedSchema = z.object({
  audience: z.literal('public'),
  version: z.string().min(1).max(64),
  algorithmVersion: z.number().int().positive(),
  rows: z.array(homeRowSchema).max(HOME_FEED_MAX_ROWS),
  nextCursor: z.string().min(1).max(512).nullable(),
});

export type HomeFeed = z.infer<typeof homeFeedSchema>;

/**
 * A feed page as clients read it: the same envelope, but each row is kept
 * only when its layout and shape are known. A row this client doesn't know
 * is dropped alone, so a newer API never breaks an older app. The audience is
 * kept as a string so a caller can refuse a non-public one itself.
 */
export const homeFeedPageSchema = homeFeedSchema.extend({
  audience: z.string(),
  rows: z
    .array(z.unknown())
    .max(HOME_FEED_MAX_ROWS)
    .transform((rows) =>
      rows.flatMap((row) => {
        const parsed = homeRowSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});

export type HomeFeedPage = z.output<typeof homeFeedPageSchema>;

/**
 * `locale` picks the feed: omitted, the feed is `en`; an unsupported locale is
 * refused. A cursor names its own feed version, so it ignores the locale.
 */
export const homeFeedQuerySchema = z.object({
  locale: localeSchema.optional(),
  cursor: z.string().min(1).max(512).optional(),
});

export type HomeFeedQuery = z.infer<typeof homeFeedQuerySchema>;
