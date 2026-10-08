import type {
  trackExternalLinks,
  trackReleases,
  trackTags,
  trackWorks,
} from './schema/tracks.js';

/**
 * What the Track page shows besides the Track itself, for `db:seed`: its
 * releases, works, tags and links, kept apart from `seed-data.ts` to stay
 * under the file size limit. Real MusicBrainz data, like the rest of the
 * seed: every release MBID with a cover URL has a front cover on the Cover
 * Art Archive.
 */

type TrackReleaseRow = typeof trackReleases.$inferInsert & { id: string };
type TrackWorkRow = typeof trackWorks.$inferInsert & { id: string };
type TrackTagRow = typeof trackTags.$inferInsert & { id: string };
type TrackExternalLinkRow = typeof trackExternalLinks.$inferInsert & {
  id: string;
};

/** The Cover Art Archive front cover of a release (500 px). */
const coverArtReleaseUrl = (mbid: string): string =>
  `https://coverartarchive.org/release/${mbid}/front-500`;

const release = (
  id: string,
  trackId: string,
  data: { mbid: string; title: string; year: number },
): TrackReleaseRow => ({
  id,
  trackId,
  ...data,
  coverArtUrl: coverArtReleaseUrl(data.mbid),
});

/**
 * Development releases: what the Track page shows. There is no `albums`
 * table behind them; releases hang off each track. Bohemian Rhapsody is on
 * two (the studio album and the compilation), and the Live Lounge bootleg
 * has no art, so its Track shows the placeholder.
 */
export const SEED_TRACK_RELEASES = [
  release('seedrelease01', 'seedtrack01', {
    mbid: '6defd963-fe91-4550-b18e-82c685603c2b',
    title: 'A Night at the Opera',
    year: 1975,
  }),
  release('seedrelease02', 'seedtrack02', {
    mbid: '993f394d-895d-4fbb-9733-f9e98e0afdd6',
    title: 'Jazz',
    year: 1978,
  }),
  release('seedrelease03', 'seedtrack03', {
    mbid: '2c8c8c15-e106-4584-9e51-963c480d8d89',
    title: '21',
    year: 2011,
  }),
  release('seedrelease04', 'seedtrack04', {
    mbid: '435fc965-9121-461e-b8da-d9b505c9dc9b',
    title: 'Parachutes',
    year: 2000,
  }),
  release('seedrelease05', 'seedtrack05', {
    mbid: '2f49e119-55f4-4086-81f9-6eaac0735e6f',
    title: "Viva la Vida: Prospekt's March Edition",
    year: 2008,
  }),
  release('seedrelease06', 'seedtrack01', {
    mbid: 'bab57bb1-67a7-460a-a5c4-15c9a1df7d2d',
    title: 'Greatest Hits',
    year: 1981,
  }),
  release('seedrelease07', 'seedtrack06', {
    mbid: 'bab57bb1-67a7-460a-a5c4-15c9a1df7d2d',
    title: 'Greatest Hits',
    year: 1981,
  }),
  release('seedrelease08', 'seedtrack08', {
    mbid: 'fba00637-79c1-441f-aeaf-3668ac928c5d',
    title: 'Elis & Tom',
    year: 1974,
  }),
  release('seedrelease09', 'seedtrack07', {
    mbid: '2f49e119-55f4-4086-81f9-6eaac0735e6f',
    title: "Viva la Vida: Prospekt's March Edition",
    year: 2008,
  }),
  {
    id: 'seedrelease10',
    trackId: 'seedtrack09',
    mbid: '8e2255bc-ce64-4e03-8dda-6089d77ebe0b',
    title: "2008-09-22: BBC Radio 1's Live Lounge: London, UK",
    year: 2008,
    coverArtUrl: null,
  },
] satisfies TrackReleaseRow[];

/** Development works (the Recording's performance of a Work). */
export const SEED_TRACK_WORKS = [
  {
    id: 'seedwork01',
    trackId: 'seedtrack01',
    mbid: '41c94a08-a551-3c86-bb17-d9a52e3a618b',
    title: 'Bohemian Rhapsody',
  },
  {
    id: 'seedwork02',
    trackId: 'seedtrack03',
    mbid: 'bbc9ce47-5d26-3489-ae0b-b06c4b8c6450',
    title: 'Rolling in the Deep',
  },
  {
    id: 'seedwork03',
    trackId: 'seedtrack05',
    mbid: 'cc3874b7-447b-371d-9666-fc5bc76c41d8',
    title: 'Viva la Vida',
  },
  {
    id: 'seedwork04',
    trackId: 'seedtrack06',
    mbid: '4e6a04c3-6897-391d-8e8c-1da7a6dce1ca',
    title: 'Under Pressure',
  },
] satisfies TrackWorkRow[];

/** Development tags with their MusicBrainz votes, most voted first per track. */
export const SEED_TRACK_TAGS = [
  { id: 'seedtag01', trackId: 'seedtrack01', name: 'rock', count: 13 },
  { id: 'seedtag02', trackId: 'seedtrack01', name: 'hard rock', count: 9 },
  { id: 'seedtag03', trackId: 'seedtrack03', name: 'pop', count: 11 },
  { id: 'seedtag04', trackId: 'seedtrack03', name: 'pop soul', count: 4 },
  { id: 'seedtag05', trackId: 'seedtrack05', name: 'pop', count: 8 },
  { id: 'seedtag06', trackId: 'seedtrack06', name: 'rock', count: 13 },
] satisfies TrackTagRow[];

const musicbrainzLink = (
  id: string,
  trackId: string,
  recordingMbid: string,
): TrackExternalLinkRow => ({
  id,
  trackId,
  url: `https://musicbrainz.org/recording/${recordingMbid}`,
  linkType: 'musicbrainz',
});

/** Development external links for the Track page. */
export const SEED_TRACK_EXTERNAL_LINKS = [
  musicbrainzLink(
    'seedlink01',
    'seedtrack01',
    'b1a9c0e9-d987-4042-ae91-78d6a3267d69',
  ),
  musicbrainzLink(
    'seedlink02',
    'seedtrack03',
    '1a13c710-4b7e-4701-8968-cd61f2e58110',
  ),
  musicbrainzLink(
    'seedlink03',
    'seedtrack05',
    '307ce9da-5690-4e21-ab71-9d12ea106e52',
  ),
] satisfies TrackExternalLinkRow[];
