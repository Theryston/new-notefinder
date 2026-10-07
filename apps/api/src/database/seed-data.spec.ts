import {
  mbidSchema,
  setUsernameBodySchema,
  signUpBodySchema,
} from '@notefinder/contracts';
import {
  assertSeedAllowed,
  SEED_ARTISTS,
  SEED_TRACK_ARTISTS,
  SEED_TRACK_EXTERNAL_LINKS,
  SEED_TRACK_RELEASES,
  SEED_TRACK_TAGS,
  SEED_TRACK_WORKS,
  SEED_TRACKS,
  SEED_USER,
  SEED_USER_PASSWORD,
} from './seed-data.js';

describe('SEED_USER', () => {
  it('passes the sign-up rules, so developers can sign in with it', () => {
    const signUp = {
      name: SEED_USER.name,
      email: SEED_USER.email,
      password: SEED_USER_PASSWORD,
    };
    const username = { username: SEED_USER.username };

    expect(signUpBodySchema.parse(signUp)).toEqual(signUp);
    expect(setUsernameBodySchema.parse(username)).toEqual(username);
  });

  it('is stored like the API stores users (lowercase, verified)', () => {
    expect(SEED_USER.username).toBe(SEED_USER.username.toLowerCase());
    expect(SEED_USER.email).toBe(SEED_USER.email.toLowerCase());
    expect(SEED_USER.emailVerified).toBe(true);
  });
});

describe('assertSeedAllowed', () => {
  it('refuses to run in production', () => {
    expect(() => assertSeedAllowed('production')).toThrowError(/production/);
    expect(() => assertSeedAllowed('development')).not.toThrow();
    expect(() => assertSeedAllowed('test')).not.toThrow();
  });
});

describe('seed catalog', () => {
  it('uses unique ids and valid MBIDs', () => {
    const ids = [
      ...SEED_ARTISTS.map((artist) => artist.id),
      ...SEED_TRACKS.map((track) => track.id),
      ...SEED_TRACK_RELEASES.map((release) => release.id),
      ...SEED_TRACK_WORKS.map((work) => work.id),
      ...SEED_TRACK_TAGS.map((tag) => tag.id),
      ...SEED_TRACK_EXTERNAL_LINKS.map((link) => link.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);

    for (const artist of SEED_ARTISTS) {
      expect(() => mbidSchema.parse(artist.mbid)).not.toThrow();
    }
    for (const track of SEED_TRACKS) {
      expect(() => mbidSchema.parse(track.recordingMbid)).not.toThrow();
      expect(track.title.length).toBeGreaterThan(0);
    }
    const recordingMbids = SEED_TRACKS.map((track) => track.recordingMbid);
    expect(new Set(recordingMbids).size).toBe(recordingMbids.length);
  });

  it('links every track, release, work, tag and link to a seeded row', () => {
    const artistIds = new Set(SEED_ARTISTS.map((artist) => artist.id));
    const trackIds = new Set(SEED_TRACKS.map((track) => track.id));

    expect(SEED_TRACK_ARTISTS.length).toBeGreaterThan(0);
    for (const link of SEED_TRACK_ARTISTS) {
      expect(trackIds.has(link.trackId)).toBe(true);
      expect(artistIds.has(link.artistId)).toBe(true);
    }
    for (const release of SEED_TRACK_RELEASES) {
      expect(trackIds.has(release.trackId)).toBe(true);
    }
    for (const work of SEED_TRACK_WORKS) {
      expect(trackIds.has(work.trackId)).toBe(true);
    }
    for (const tag of SEED_TRACK_TAGS) {
      expect(trackIds.has(tag.trackId)).toBe(true);
    }
    for (const link of SEED_TRACK_EXTERNAL_LINKS) {
      expect(trackIds.has(link.trackId)).toBe(true);
    }
  });

  it('covers every artist and track at least once', () => {
    const linkedArtists = new Set(
      SEED_TRACK_ARTISTS.map((link) => link.artistId),
    );
    const linkedTracks = new Set(
      SEED_TRACK_ARTISTS.map((link) => link.trackId),
    );
    for (const artist of SEED_ARTISTS) {
      expect(linkedArtists.has(artist.id)).toBe(true);
    }
    for (const track of SEED_TRACKS) {
      expect(linkedTracks.has(track.id)).toBe(true);
    }
  });
});
