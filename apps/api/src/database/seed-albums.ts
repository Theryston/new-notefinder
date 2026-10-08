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
 * The release-group MBIDs are synthetic placeholders in the seed's own style
 * (the seed never talks to MusicBrainz). Their covers are Cover Art Archive
 * URLs that miss, so the web shows its geometric placeholder, the same
 * fallback a real album without art gets. The album titles of the first five
 * match the seed releases of the Tracks; the last two exist only to exercise
 * header rules (several artists, no genres and no type). The album tracks
 * cover a multi-track album, a Track on two Albums (a studio album and a
 * compilation) and a two-disc album whose second disc is named.
 */

type AlbumRow = typeof albums.$inferInsert & { id: string };
type AlbumArtistRow = typeof albumArtists.$inferInsert;
type AlbumDiscRow = typeof albumDiscs.$inferInsert;
type AlbumTrackRow = typeof albumTracks.$inferInsert;
type LegacyAlbumIdRow = typeof legacyAlbumIds.$inferInsert;

/** The Cover Art Archive front cover of a release group, as the importer writes it. */
const coverArtReleaseGroupUrl = (mbid: string): string =>
  `https://coverartarchive.org/release-group/${mbid}/front-500`;

const seedAlbumMbid = (n: number): string =>
  `00000000-0000-4000-8000-00000000a${String(n).padStart(3, '0')}`;

export const SEED_ALBUMS = [
  {
    id: 'seedalbum01',
    mbid: seedAlbumMbid(1),
    title: 'A Night at the Opera',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 1975,
    genres: ['rock'],
    coverArtUrl: coverArtReleaseGroupUrl(seedAlbumMbid(1)),
  },
  {
    id: 'seedalbum02',
    mbid: seedAlbumMbid(2),
    title: 'Jazz',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 1978,
    genres: ['rock', 'pop'],
    coverArtUrl: coverArtReleaseGroupUrl(seedAlbumMbid(2)),
  },
  {
    id: 'seedalbum03',
    mbid: seedAlbumMbid(3),
    title: '21',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 2011,
    genres: ['pop', 'soul'],
    coverArtUrl: coverArtReleaseGroupUrl(seedAlbumMbid(3)),
  },
  {
    id: 'seedalbum04',
    mbid: seedAlbumMbid(4),
    title: 'Parachutes',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 2000,
    genres: ['rock', 'alternative'],
    coverArtUrl: coverArtReleaseGroupUrl(seedAlbumMbid(4)),
  },
  {
    id: 'seedalbum05',
    mbid: seedAlbumMbid(5),
    title: 'Viva la Vida or Death and All His Friends',
    primaryType: 'Album',
    secondaryTypes: [],
    year: 2008,
    genres: ['rock', 'pop'],
    coverArtUrl: coverArtReleaseGroupUrl(seedAlbumMbid(5)),
  },
  {
    id: 'seedalbum06',
    mbid: seedAlbumMbid(6),
    title: 'Stadium Sessions',
    primaryType: 'Album',
    secondaryTypes: ['Compilation', 'Live'],
    year: 2012,
    genres: ['pop'],
    coverArtUrl: null,
  },
  {
    id: 'seedalbum07',
    mbid: seedAlbumMbid(7),
    title: 'Demo Tapes',
    primaryType: null,
    secondaryTypes: [],
    year: null,
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
  { albumId: 'seedalbum06', artistId: 'seedartist02', position: 1 },
  { albumId: 'seedalbum06', artistId: 'seedartist03', position: 2 },
  { albumId: 'seedalbum07', artistId: 'seedartist03', position: 0 },
] satisfies AlbumArtistRow[];

/**
 * Discs in MusicBrainz numbering (from 1). Every album has at least one disc
 * whenever it has tracks; the second disc of "Viva la Vida" carries a name.
 */
export const SEED_ALBUM_DISCS = [
  { albumId: 'seedalbum01', position: 1, title: null },
  { albumId: 'seedalbum02', position: 1, title: null },
  { albumId: 'seedalbum03', position: 1, title: null },
  { albumId: 'seedalbum04', position: 1, title: null },
  { albumId: 'seedalbum05', position: 1, title: null },
  { albumId: 'seedalbum05', position: 2, title: 'Bonus Disc' },
  { albumId: 'seedalbum06', position: 1, title: null },
  { albumId: 'seedalbum07', position: 1, title: null },
] satisfies AlbumDiscRow[];

/**
 * Album tracks in album order: every seed album lists at least one Track.
 * `seedtrack01` sits on two albums (the studio album and the compilation) and
 * `seedalbum06` lists several Tracks.
 */
export const SEED_ALBUM_TRACKS = [
  {
    albumId: 'seedalbum01',
    trackId: 'seedtrack01',
    discPosition: 1,
    trackPosition: 1,
  },
  {
    albumId: 'seedalbum02',
    trackId: 'seedtrack02',
    discPosition: 1,
    trackPosition: 1,
  },
  {
    albumId: 'seedalbum03',
    trackId: 'seedtrack03',
    discPosition: 1,
    trackPosition: 1,
  },
  {
    albumId: 'seedalbum04',
    trackId: 'seedtrack04',
    discPosition: 1,
    trackPosition: 1,
  },
  {
    albumId: 'seedalbum05',
    trackId: 'seedtrack05',
    discPosition: 1,
    trackPosition: 1,
  },
  {
    albumId: 'seedalbum05',
    trackId: 'seedtrack04',
    discPosition: 2,
    trackPosition: 1,
  },
  {
    albumId: 'seedalbum06',
    trackId: 'seedtrack01',
    discPosition: 1,
    trackPosition: 1,
  },
  {
    albumId: 'seedalbum06',
    trackId: 'seedtrack02',
    discPosition: 1,
    trackPosition: 2,
  },
  {
    albumId: 'seedalbum06',
    trackId: 'seedtrack03',
    discPosition: 1,
    trackPosition: 3,
  },
  {
    albumId: 'seedalbum06',
    trackId: 'seedtrack05',
    discPosition: 1,
    trackPosition: 4,
  },
  {
    albumId: 'seedalbum07',
    trackId: 'seedtrack04',
    discPosition: 1,
    trackPosition: 1,
  },
] satisfies AlbumTrackRow[];

/** A legacy album URL that resolves through the map to a seeded album. */
export const SEED_LEGACY_ALBUM_IDS = [
  { legacyId: 'seedlegacyalbum01', albumId: 'seedalbum01' },
] satisfies LegacyAlbumIdRow[];
