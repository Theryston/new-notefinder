import { mbidSchema } from '@notefinder/contracts';
import { z } from 'zod';
import data from './tiny-seed-data.json' with { type: 'json' };

/**
 * What the `tiny` dataset seeds after the empty MusicBrainz schema is
 * created: a small slice of the real MusicBrainz catalog (ten albums, their
 * artists, Recordings, release groups, releases, media, tracks, release
 * events and genres), stored in `tiny-seed-data.json` with its real MBIDs.
 * So a cover URL built from a release MBID loads from the Cover Art Archive,
 * an MBID resolves on musicbrainz.org, and the Lyrics LRCLIB knows for these
 * songs match. Every restore of `tiny` lays down the same rows, without
 * touching the network. The data is pure here; the SQL lives in
 * `TinySeedRepository`.
 */

const creditSchema = z.array(
  z.object({
    /** The credited artist's MBID. */
    artist: mbidSchema,
    /** The name it is credited under. */
    name: z.string(),
    joinPhrase: z.string(),
  }),
);

export type TinySeedCredit = z.output<typeof creditSchema>;

const namedSchema = z.object({ mbid: mbidSchema, name: z.string() });

const tinySeedSchema = z.object({
  areas: z.array(namedSchema.extend({ code: z.string().length(2) })),
  artists: z.array(
    namedSchema.extend({
      sortName: z.string(),
      aliases: z.array(z.object({ name: z.string(), sortName: z.string() })),
    }),
  ),
  genres: z.array(namedSchema),
  releaseStatuses: z.array(namedSchema),
  releaseGroupPrimaryTypes: z.array(namedSchema),
  recordings: z.array(
    z.object({
      mbid: mbidSchema,
      title: z.string(),
      lengthMs: z.number().int().positive().nullable(),
      disambiguation: z.string(),
      video: z.boolean(),
      artistCredit: creditSchema,
      isrcs: z.array(z.string().length(12)),
    }),
  ),
  releaseGroups: z.array(
    z.object({
      mbid: mbidSchema,
      title: z.string(),
      primaryType: z.string().nullable(),
      artistCredit: creditSchema,
      tags: z.array(
        z.object({ name: z.string(), count: z.number().int().positive() }),
      ),
    }),
  ),
  releases: z.array(
    z.object({
      mbid: mbidSchema,
      title: z.string(),
      releaseGroup: mbidSchema,
      status: z.string().nullable(),
      artistCredit: creditSchema,
      events: z.array(
        z.object({
          /** ISO 3166-1 alpha-2; null for an unknown country. */
          country: z.string().length(2).nullable(),
          year: z.number().int().nullable(),
          month: z.number().int().nullable(),
          day: z.number().int().nullable(),
        }),
      ),
      media: z.array(
        z.object({
          mbid: mbidSchema,
          position: z.number().int().positive(),
          title: z.string(),
          tracks: z.array(
            z.object({
              mbid: mbidSchema,
              position: z.number().int().positive(),
              number: z.string(),
              title: z.string(),
              lengthMs: z.number().int().positive().nullable(),
              /** The Recording's MBID; a track is credited like it. */
              recording: mbidSchema,
            }),
          ),
        }),
      ),
    }),
  ),
});

export type TinySeed = z.output<typeof tinySeedSchema>;

/** The `tiny` catalog, checked against its shape once on load. */
export const tinySeed: TinySeed = tinySeedSchema.parse(data);

export const TINY_RECORDING_COUNT = tinySeed.recordings.length;

/** The credit as printed: every credited name followed by its join phrase. */
export const printedCredit = (credit: TinySeedCredit): string =>
  credit.map((entry) => entry.name + entry.joinPhrase).join('');

/**
 * Artist credits have MBIDs that never leave the service, so the seed gives
 * each one a fixed MBID of a readable series: `tinyArtistCreditMbid(7)`
 * ends in `...000007`.
 */
export const tinyArtistCreditMbid = (n: number): string =>
  `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;

export type TinySeedCreditRow = {
  /** Tells credits apart: the same artists, names and join phrases. */
  key: string;
  mbid: string;
  name: string;
  entries: TinySeedCredit;
};

export const creditKey = (credit: TinySeedCredit): string =>
  JSON.stringify(credit);

/**
 * Every distinct artist credit of the seed (Recordings, then release groups,
 * then releases), each once, in first-use order with its fixed MBID.
 */
export const tinySeedCredits = (seed: TinySeed): TinySeedCreditRow[] => {
  const rows = new Map<string, TinySeedCreditRow>();
  const credits = [
    ...seed.recordings.map((recording) => recording.artistCredit),
    ...seed.releaseGroups.map((group) => group.artistCredit),
    ...seed.releases.map((release) => release.artistCredit),
  ];
  for (const entries of credits) {
    const key = creditKey(entries);
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        mbid: tinyArtistCreditMbid(rows.size + 1),
        name: printedCredit(entries),
        entries,
      });
    }
  }
  return [...rows.values()];
};

/** Every tag name the release groups carry, each once, sorted. */
export const tinySeedTagNames = (seed: TinySeed): string[] =>
  [
    ...new Set(
      seed.releaseGroups.flatMap((group) => group.tags.map((tag) => tag.name)),
    ),
  ].sort();
