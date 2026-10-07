import type { artists, trackArtists } from './schema/artists.js';
import type {
  trackExternalLinks,
  trackReleases,
  tracks,
  trackTags,
  trackWorks,
} from './schema/tracks.js';
import type { users } from './schema/users.js';

/**
 * Deterministic development data for `db:seed`. Everything here is pure (no
 * database access) so it can be unit tested; `seed.ts` writes it. It grows
 * with the features that add tables.
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

/** The seed writes fake data, so it must never touch a production database. */
export const assertSeedAllowed = (nodeEnv: string): void => {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed the database when NODE_ENV=production');
  }
};

type ArtistRow = typeof artists.$inferInsert & { id: string };
type TrackRow = typeof tracks.$inferInsert & { id: string };
type TrackArtistRow = typeof trackArtists.$inferInsert;
type TrackReleaseRow = typeof trackReleases.$inferInsert & { id: string };
type TrackWorkRow = typeof trackWorks.$inferInsert & { id: string };
type TrackTagRow = typeof trackTags.$inferInsert & { id: string };
type TrackExternalLinkRow = typeof trackExternalLinks.$inferInsert & {
  id: string;
};

/**
 * Development artists with real MusicBrainz artist MBIDs, so linked search
 * hits resolve during local development.
 */
export const SEED_ARTISTS = [
  {
    id: 'seedartist01',
    mbid: '0383dadf-2a4e-4d10-a46a-e9e041da8eb3',
    name: 'Queen',
    genres: ['rock', 'pop'],
  },
  {
    id: 'seedartist02',
    mbid: '6be1c793-9d40-4d2e-92f2-6f502ced7bdb',
    name: 'Adele',
    genres: ['pop', 'soul'],
  },
  {
    id: 'seedartist03',
    mbid: '9fff2f8a-414e-47cd-ab65-90ff02791d70',
    name: 'Coldplay',
    genres: ['rock', 'alternative'],
  },
] satisfies ArtistRow[];

/** Development tracks: one row per fake Recording MBID. */
export const SEED_TRACKS = [
  {
    id: 'seedtrack01',
    recordingMbid: '11111111-1111-4111-8111-111111111111',
    title: 'Bohemian Rhapsody',
    lengthMs: 354_000,
    disambiguation: '',
    video: false,
    isrcs: ['GBUM71029604'],
    genres: ['rock'],
  },
  {
    id: 'seedtrack02',
    recordingMbid: '22222222-2222-4222-8222-222222222222',
    title: "Don't Stop Me Now",
    lengthMs: 209_000,
    disambiguation: '',
    video: false,
    isrcs: ['GBUM71029605'],
    genres: ['rock', 'pop'],
  },
  {
    id: 'seedtrack03',
    recordingMbid: '33333333-3333-4333-8333-333333333333',
    title: 'Rolling in the Deep',
    lengthMs: 228_000,
    disambiguation: '',
    video: false,
    isrcs: ['GBBKS1000358'],
    genres: ['pop', 'soul'],
  },
  {
    id: 'seedtrack04',
    recordingMbid: '44444444-4444-4444-8444-444444444444',
    title: 'Yellow',
    lengthMs: 266_000,
    disambiguation: 'album version',
    video: false,
    isrcs: ['GBAYE0000563'],
    genres: ['rock', 'alternative'],
  },
  {
    id: 'seedtrack05',
    recordingMbid: '55555555-5555-4555-8555-555555555555',
    title: 'Viva la Vida',
    lengthMs: 242_000,
    disambiguation: '',
    video: false,
    isrcs: ['GBAYE0801010'],
    genres: ['rock', 'pop'],
  },
] satisfies TrackRow[];

/** Which artists credit which tracks (drives each header `trackCount`). */
export const SEED_TRACK_ARTISTS = [
  { trackId: 'seedtrack01', artistId: 'seedartist01' },
  { trackId: 'seedtrack02', artistId: 'seedartist01' },
  { trackId: 'seedtrack03', artistId: 'seedartist02' },
  { trackId: 'seedtrack04', artistId: 'seedartist03' },
  { trackId: 'seedtrack05', artistId: 'seedartist03' },
] satisfies TrackArtistRow[];

/**
 * Development releases (the "albums" of the seed): what the Track page
 * shows. There is no `albums` table; releases hang off each track.
 */
export const SEED_TRACK_RELEASES = [
  {
    id: 'seedrelease01',
    trackId: 'seedtrack01',
    mbid: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f123456789',
    title: 'A Night at the Opera',
    year: 1975,
    coverArtUrl:
      'https://coverartarchive.org/release/a1b2c3d4-e5f6-4a7b-8c9d-e0f123456789/front-500',
  },
  {
    id: 'seedrelease02',
    trackId: 'seedtrack02',
    mbid: 'b2c3d4e5-f6a7-4b8c-9d0e-f12345678901',
    title: 'Jazz',
    year: 1978,
    coverArtUrl:
      'https://coverartarchive.org/release/b2c3d4e5-f6a7-4b8c-9d0e-f12345678901/front-500',
  },
  {
    id: 'seedrelease03',
    trackId: 'seedtrack03',
    mbid: 'c3d4e5f6-a7b8-4c9d-8e0f-123456789012',
    title: '21',
    year: 2011,
    coverArtUrl:
      'https://coverartarchive.org/release/c3d4e5f6-a7b8-4c9d-8e0f-123456789012/front-500',
  },
  {
    id: 'seedrelease04',
    trackId: 'seedtrack04',
    mbid: 'd4e5f6a7-b8c9-4d0e-8f12-234567890123',
    title: 'Parachutes',
    year: 2000,
    coverArtUrl:
      'https://coverartarchive.org/release/d4e5f6a7-b8c9-4d0e-8f12-234567890123/front-500',
  },
  {
    id: 'seedrelease05',
    trackId: 'seedtrack05',
    mbid: 'e5f6a7b8-c9d0-4e1f-8234-345678901234',
    title: 'Viva la Vida or Death and All His Friends',
    year: 2008,
    coverArtUrl:
      'https://coverartarchive.org/release/e5f6a7b8-c9d0-4e1f-8234-345678901234/front-500',
  },
] satisfies TrackReleaseRow[];

/** Development works for the Track page. */
export const SEED_TRACK_WORKS = [
  {
    id: 'seedwork01',
    trackId: 'seedtrack01',
    mbid: 'f6a7b8c9-d0e1-4f23-8456-456789012345',
    title: 'Bohemian Rhapsody',
  },
  {
    id: 'seedwork02',
    trackId: 'seedtrack03',
    mbid: 'a7b8c9d0-e1f2-4a34-8567-567890123456',
    title: 'Rolling in the Deep',
  },
  {
    id: 'seedwork03',
    trackId: 'seedtrack05',
    mbid: 'b8c9d0e1-f2a3-4b45-8678-678901234567',
    title: 'Viva la Vida',
  },
] satisfies TrackWorkRow[];

/** Development tags, most voted first per track. */
export const SEED_TRACK_TAGS = [
  { id: 'seedtag01', trackId: 'seedtrack01', name: 'rock', count: 100 },
  { id: 'seedtag02', trackId: 'seedtrack01', name: 'classic rock', count: 80 },
  { id: 'seedtag03', trackId: 'seedtrack03', name: 'pop', count: 90 },
  { id: 'seedtag04', trackId: 'seedtrack03', name: 'soul', count: 70 },
  { id: 'seedtag05', trackId: 'seedtrack05', name: 'alternative', count: 85 },
] satisfies TrackTagRow[];

/** Development external links for the Track page. */
export const SEED_TRACK_EXTERNAL_LINKS = [
  {
    id: 'seedlink01',
    trackId: 'seedtrack01',
    url: 'https://musicbrainz.org/recording/11111111-1111-4111-8111-111111111111',
    linkType: 'musicbrainz',
  },
  {
    id: 'seedlink02',
    trackId: 'seedtrack03',
    url: 'https://musicbrainz.org/recording/33333333-3333-4333-8333-333333333333',
    linkType: 'musicbrainz',
  },
  {
    id: 'seedlink03',
    trackId: 'seedtrack05',
    url: 'https://musicbrainz.org/recording/55555555-5555-4555-8555-555555555555',
    linkType: 'musicbrainz',
  },
] satisfies TrackExternalLinkRow[];
