import type {
  albumArtists,
  albumDiscs,
  albums,
  albumTracks,
  legacyAlbumIds,
} from './schema/albums.js';

/**
 * Development albums for `db:seed`, kept apart from `seed-data.ts` to stay
 * under the file size limit. Pure data, like the rest of the seed.
 *
 * Real MusicBrainz release groups: their covers load from the Cover Art
 * Archive, except the Live Lounge bootleg, which has no art (the web shows
 * its geometric placeholder) and no primary type or genres, the header rules
 * a real album can hit. "Elis & Tom" credits two artists, "Greatest Hits" is
 * a compilation sharing Bohemian Rhapsody with "A Night at the Opera", and
 * the Prospekt's March edition of "Viva la Vida" has a named second disc.
 */

type AlbumRow = typeof albums.$inferInsert & { id: string };
type AlbumArtistRow = typeof albumArtists.$inferInsert;
type AlbumDiscRow = typeof albumDiscs.$inferInsert;
type AlbumTrackRow = typeof albumTracks.$inferInsert;
type LegacyAlbumIdRow = typeof legacyAlbumIds.$inferInsert;

/** The Cover Art Archive front cover of a release group (500 px). */
const coverArtReleaseGroupUrl = (mbid: string): string =>
  `https://coverartarchive.org/release-group/${mbid}/front-500`;

const SEED_ALBUMS_WITH_ART = [
  {
    id: 'seedalbum01',
    mbid: '6b47c9a0-b9e1-3df9-a5e8-50a6ce0dbdbd',
    title: 'A Night at the Opera',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 1975,
    genres: ['hard rock', 'rock'],
  },
  {
    id: 'seedalbum02',
    mbid: 'c192ea46-7377-34f0-b332-dd9810edd560',
    title: 'Jazz',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 1978,
    genres: ['hard rock', 'rock'],
  },
  {
    id: 'seedalbum03',
    mbid: 'e4174758-d333-4a8e-a31f-dd0edd51518e',
    title: '21',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 2011,
    genres: ['pop', 'pop soul'],
  },
  {
    id: 'seedalbum04',
    mbid: '1dc4c347-a1db-32aa-b14f-bc9cc507b843',
    title: 'Parachutes',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 2000,
    genres: ['alternative rock', 'rock'],
  },
  {
    id: 'seedalbum05',
    mbid: 'a1084754-8bb5-3ebc-bbd2-6a27d48e798a',
    title: 'Viva la Vida or Death and All His Friends',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 2008,
    genres: ['alternative rock', 'pop rock'],
  },
  {
    id: 'seedalbum06',
    mbid: '69ce61c8-127f-3809-95d8-62fdf3ae1347',
    title: 'Greatest Hits',
    primaryType: 'Album',
    secondaryTypes: ['Compilation'],
    year: 1981,
    genres: ['rock', 'pop rock'],
  },
  {
    id: 'seedalbum07',
    mbid: 'f9520003-6075-310e-b650-bbaa8aaeab4d',
    title: 'Elis & Tom',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 1974,
    genres: ['bossa nova', 'jazz'],
  },
].map((album) => ({
  ...album,
  coverArtUrl: coverArtReleaseGroupUrl(album.mbid),
}));

export const SEED_ALBUMS = [
  ...SEED_ALBUMS_WITH_ART,
  {
    id: 'seedalbum08',
    mbid: '11ce3c93-0325-439e-8de7-fab397ba839c',
    title: "2008-09-22: BBC Radio 1's Live Lounge: London, UK",
    primaryType: null,
    secondaryTypes: ['Live'],
    year: 2008,
    genres: [],
    coverArtUrl: null,
  },
] satisfies AlbumRow[];

/** Credits in MusicBrainz order: `position` counts from 0 per album. */
export const SEED_ALBUM_ARTISTS = [
  { albumId: 'seedalbum01', artistId: 'seedartist01', position: 0 },
  { albumId: 'seedalbum02', artistId: 'seedartist01', position: 0 },
  { albumId: 'seedalbum03', artistId: 'seedartist02', position: 0 },
  { albumId: 'seedalbum04', artistId: 'seedartist03', position: 0 },
  { albumId: 'seedalbum05', artistId: 'seedartist03', position: 0 },
  { albumId: 'seedalbum06', artistId: 'seedartist01', position: 0 },
  { albumId: 'seedalbum07', artistId: 'seedartist05', position: 0 },
  { albumId: 'seedalbum07', artistId: 'seedartist06', position: 1 },
  { albumId: 'seedalbum08', artistId: 'seedartist02', position: 0 },
] satisfies AlbumArtistRow[];

/**
 * Discs in MusicBrainz numbering (from 1), from the release each album's
 * tracks come from; the second disc of "Viva la Vida" carries its name.
 */
export const SEED_ALBUM_DISCS = [
  { albumId: 'seedalbum01', position: 1, title: null },
  { albumId: 'seedalbum02', position: 1, title: null },
  { albumId: 'seedalbum03', position: 1, title: null },
  { albumId: 'seedalbum04', position: 1, title: null },
  { albumId: 'seedalbum05', position: 1, title: null },
  { albumId: 'seedalbum05', position: 2, title: 'Prospekt’s March EP' },
  { albumId: 'seedalbum06', position: 1, title: null },
  { albumId: 'seedalbum07', position: 1, title: null },
  { albumId: 'seedalbum08', position: 1, title: null },
] satisfies AlbumDiscRow[];

const albumTrack = (
  albumId: string,
  trackId: string,
  [discPosition, trackPosition]: [number, number],
): AlbumTrackRow => ({ albumId, trackId, discPosition, trackPosition });

/**
 * Album tracks at their real disc and track positions. `seedtrack01`
 * (Bohemian Rhapsody) sits on two albums, the studio album and the
 * compilation, and `seedalbum05` lists a Track on each disc.
 */
export const SEED_ALBUM_TRACKS = [
  albumTrack('seedalbum01', 'seedtrack01', [1, 11]),
  albumTrack('seedalbum02', 'seedtrack02', [1, 12]),
  albumTrack('seedalbum03', 'seedtrack03', [1, 1]),
  albumTrack('seedalbum04', 'seedtrack04', [1, 5]),
  albumTrack('seedalbum05', 'seedtrack05', [1, 7]),
  albumTrack('seedalbum05', 'seedtrack07', [2, 1]),
  albumTrack('seedalbum06', 'seedtrack01', [1, 2]),
  albumTrack('seedalbum06', 'seedtrack06', [1, 7]),
  albumTrack('seedalbum07', 'seedtrack08', [1, 1]),
  albumTrack('seedalbum08', 'seedtrack09', [1, 1]),
] satisfies AlbumTrackRow[];

/** A legacy album URL that resolves through the map to a seeded album. */
export const SEED_LEGACY_ALBUM_IDS = [
  { legacyId: 'seedlegacyalbum01', albumId: 'seedalbum01' },
] satisfies LegacyAlbumIdRow[];
