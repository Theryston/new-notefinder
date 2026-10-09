import type { artists, trackArtists } from './schema/artists.js';
import type { trackProcessings } from './schema/track-processings.js';
import type { tracks } from './schema/tracks.js';
import type { users } from './schema/users.js';

/**
 * Deterministic development data for `db:seed`. Everything here is pure (no
 * database access) so it can be unit tested; `seed.ts` writes it. It grows
 * with the features that add tables.
 *
 * The catalog rows are real MusicBrainz data (artist, Recording, release,
 * release group and Work MBIDs), a subset of the Music catalog's `tiny`
 * dataset, so covers load from the Cover Art Archive and every MBID resolves
 * on musicbrainz.org.
 */

type UserRow = typeof users.$inferInsert & { id: string };

/**
 * The development user. `seed.ts` also gives it a password
 * (`SEED_USER_PASSWORD`), so developers can sign in right after seeding.
 */
export const SEED_USER = {
  id: 'seeduser01',
  name: 'Seed Creator',
  email: 'seed@notefinder.dev',
  emailVerified: true,
  username: 'seed_creator',
  role: 'USER',
} satisfies UserRow;

// Development only: `assertSeedAllowed` keeps the seed away from production.
export const SEED_USER_PASSWORD = 'notefinder-seed';

/** The seed writes development data (a known password), never to production. */
export const assertSeedAllowed = (nodeEnv: string): void => {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed the database when NODE_ENV=production');
  }
};

type ArtistRow = typeof artists.$inferInsert & { id: string };
type TrackRow = typeof tracks.$inferInsert & { id: string };
type TrackArtistRow = typeof trackArtists.$inferInsert;

/** Development artists: their real MusicBrainz MBIDs and top genres. */
export const SEED_ARTISTS = [
  {
    id: 'seedartist01',
    mbid: '0383dadf-2a4e-4d10-a46a-e9e041da8eb3',
    name: 'Queen',
    genres: ['rock', 'glam rock'],
  },
  {
    id: 'seedartist02',
    mbid: 'cc2c9c3c-b7bc-4b8b-84d8-4fbd8779e493',
    name: 'Adele',
    genres: ['pop', 'soul'],
  },
  {
    id: 'seedartist03',
    mbid: 'cc197bad-dc9c-440d-a5b5-d52ba2e14234',
    name: 'Coldplay',
    genres: ['alternative rock', 'pop'],
  },
  {
    id: 'seedartist04',
    mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50',
    name: 'David Bowie',
    genres: ['art rock', 'glam rock'],
  },
  {
    id: 'seedartist05',
    mbid: 'e9e85a54-074c-4d29-a886-bcaaa9d44f9f',
    name: 'Elis Regina',
    genres: ['mpb', 'bossa nova'],
  },
  {
    id: 'seedartist06',
    mbid: '7a8dbe84-f4c0-4457-bfa3-edced1f8cde0',
    name: 'Antônio Carlos Jobim',
    genres: ['bossa nova', 'latin jazz'],
  },
] satisfies ArtistRow[];

/**
 * Development tracks: one row per real Recording MBID. Genres are the
 * Recording's own most voted ones, else its release group's, else its
 * artists' (the Music catalog's fallback).
 */
export const SEED_TRACKS = [
  {
    id: 'seedtrack01',
    recordingMbid: 'b1a9c0e9-d987-4042-ae91-78d6a3267d69',
    title: 'Bohemian Rhapsody',
    lengthMs: 355_106,
    disambiguation: '',
    video: false,
    isrcs: ['GBCEE0100112', 'GBCEE0500364'],
    genres: ['rock', 'hard rock'],
  },
  {
    id: 'seedtrack02',
    recordingMbid: 'd4009c09-a339-4b89-bc45-d91ab649acb6',
    title: 'Don’t Stop Me Now',
    lengthMs: 210_146,
    disambiguation: '',
    video: false,
    isrcs: ['GBCEE0100118', 'GBCEE0900139'],
    genres: ['rock', 'hard rock'],
  },
  {
    id: 'seedtrack03',
    recordingMbid: '1a13c710-4b7e-4701-8968-cd61f2e58110',
    title: 'Rolling in the Deep',
    lengthMs: 228_293,
    disambiguation: '',
    video: false,
    isrcs: ['GBBKS1000335'],
    genres: ['pop', 'pop soul'],
  },
  {
    id: 'seedtrack04',
    recordingMbid: '729cf505-94eb-4fbe-bc76-cbae44cff091',
    title: 'Yellow',
    lengthMs: 269_110,
    disambiguation: '',
    video: false,
    isrcs: ['GBAYE0000267', 'GBAYE1600170'],
    genres: ['alternative rock', 'pop rock'],
  },
  {
    id: 'seedtrack05',
    recordingMbid: '307ce9da-5690-4e21-ab71-9d12ea106e52',
    title: 'Viva la vida',
    lengthMs: 241_445,
    disambiguation: '',
    video: false,
    isrcs: ['GABAY0080086', 'GBAYE0800265'],
    genres: ['pop', 'pop rock'],
  },
  {
    id: 'seedtrack06',
    recordingMbid: '32c7e292-14f1-4080-bddf-ef852e0a4c59',
    title: 'Under Pressure',
    lengthMs: 243_000,
    disambiguation: '',
    video: false,
    isrcs: ['CBCEG8100001', 'GBCEE0900136'],
    genres: ['rock', 'pop rock'],
  },
  {
    id: 'seedtrack07',
    recordingMbid: 'df254587-24f2-4b13-9a67-292acf1a2aca',
    title: 'Life in Technicolor ii',
    lengthMs: 245_933,
    disambiguation: '',
    video: false,
    isrcs: ['GBAYE0801695', 'GBAYE1600221'],
    genres: ['rock', 'alternative rock'],
  },
  {
    id: 'seedtrack08',
    recordingMbid: '58b20cb0-34d8-46d7-8782-4d2865a36b2a',
    title: 'Águas De Março',
    lengthMs: 214_004,
    disambiguation: '',
    video: false,
    isrcs: [],
    genres: ['bossa nova', 'jazz'],
  },
  {
    id: 'seedtrack09',
    recordingMbid: '476a8466-1f82-46a8-8706-648a41c98d3c',
    title: 'Hometown Glory',
    lengthMs: 216_000,
    disambiguation: '',
    video: false,
    isrcs: [],
    genres: ['pop', 'soul'],
  },
] satisfies TrackRow[];

/**
 * Which artists credit which tracks (drives each header `trackCount`):
 * "Queen & David Bowie" and "Elis Regina & António Carlos Jobim" credit two.
 */
export const SEED_TRACK_ARTISTS = [
  { trackId: 'seedtrack01', artistId: 'seedartist01' },
  { trackId: 'seedtrack02', artistId: 'seedartist01' },
  { trackId: 'seedtrack03', artistId: 'seedartist02' },
  { trackId: 'seedtrack04', artistId: 'seedartist03' },
  { trackId: 'seedtrack05', artistId: 'seedartist03' },
  { trackId: 'seedtrack06', artistId: 'seedartist01' },
  { trackId: 'seedtrack06', artistId: 'seedartist04' },
  { trackId: 'seedtrack07', artistId: 'seedartist03' },
  { trackId: 'seedtrack08', artistId: 'seedartist05' },
  { trackId: 'seedtrack08', artistId: 'seedartist06' },
  { trackId: 'seedtrack09', artistId: 'seedartist02' },
] satisfies TrackArtistRow[];

type TrackProcessingRow = typeof trackProcessings.$inferInsert & { id: string };

/**
 * Every seeded Track has a completed Processing: Artist and Album pages list
 * only completed Tracks (ADR 0005), so without these they would show nothing.
 */
export const SEED_TRACK_PROCESSINGS: TrackProcessingRow[] = SEED_TRACKS.map(
  (track, index) => ({
    id: `seedprocessing${String(index + 1).padStart(2, '0')}`,
    trackId: track.id,
    status: 'COMPLETED',
  }),
);
