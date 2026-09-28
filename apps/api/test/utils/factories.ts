import bcrypt from 'bcryptjs';
import type { Database } from '../../src/database/database.js';
import { albums } from '../../src/database/schema/albums.js';
import { artists } from '../../src/database/schema/artists.js';
import { accounts } from '../../src/database/schema/auth.js';
import {
  thumbnails,
  trackArtists,
  trackNotes,
  tracks,
} from '../../src/database/schema/tracks.js';
import { users } from '../../src/database/schema/users.js';
import { hashPassword } from '../../src/modules/auth/password.js';

export type Artist = typeof artists.$inferSelect;
export type Album = typeof albums.$inferSelect;
type Track = typeof tracks.$inferSelect;
type Thumbnail = typeof thumbnails.$inferSelect;
type TrackNote = typeof trackNotes.$inferSelect;
export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;

type NewArtist = typeof artists.$inferInsert;
type NewAlbum = typeof albums.$inferInsert;
type NewTrack = typeof tracks.$inferInsert;
type NewThumbnail = Omit<typeof thumbnails.$inferInsert, 'trackId'>;
type NewTrackNote = Omit<typeof trackNotes.$inferInsert, 'trackId'>;
type NewUser = typeof users.$inferInsert;

// Per-entity counters make default values unique and predictable within a
// spec ("Artist 1", "Artist 2", …). `resetDatabase` restarts them.
const sequences = new Map<string, number>();

const next = (entity: string): number => {
  const value = (sequences.get(entity) ?? 0) + 1;
  sequences.set(entity, value);
  return value;
};

export const resetFactorySequences = (): void => {
  sequences.clear();
};

const insertOne = async <T>(rows: Promise<T[]>): Promise<T> => {
  const [row] = await rows;
  if (row === undefined) {
    throw new Error('Insert returned no row');
  }
  return row;
};

export const createArtist = (
  db: Database,
  overrides: Partial<NewArtist> = {},
): Promise<Artist> => {
  const n = next('artist');
  return insertOne(
    db
      .insert(artists)
      .values({ name: `Artist ${n}`, ytId: `UC-artist-${n}`, ...overrides })
      .returning(),
  );
};

export const createAlbum = (
  db: Database,
  overrides: Partial<NewAlbum> = {},
): Promise<Album> => {
  const n = next('album');
  return insertOne(
    db
      .insert(albums)
      .values({ name: `Album ${n}`, ytId: `MPRE-album-${n}`, ...overrides })
      .returning(),
  );
};

export type CreateTrackOptions = {
  /** Column overrides for the track row. */
  track?: Partial<NewTrack>;
  /** Linked artists, in order. Defaults to one new artist. */
  artists?: Artist[];
  /** Sets `albumId`. Defaults to no album. */
  album?: Album;
  /** Defaults to one 480x360 thumbnail. */
  thumbnails?: Partial<NewThumbnail>[];
  /** Defaults to none; each entry is merged over an A4 half-second note. */
  notes?: Partial<NewTrackNote>[];
};

export type CreatedTrack = {
  track: Track;
  artists: Artist[];
  thumbnails: Thumbnail[];
  notes: TrackNote[];
};

/** Creates a completed track with its artists, thumbnails and notes. */
export const createTrack = async (
  db: Database,
  options: CreateTrackOptions = {},
): Promise<CreatedTrack> => {
  const n = next('track');
  const track = await insertOne(
    db
      .insert(tracks)
      .values({
        ytId: `yt-track-${n}`,
        status: 'COMPLETED',
        title: `Track ${n}`,
        duration: '3:00',
        durationSeconds: 180,
        albumId: options.album?.id,
        ...options.track,
      })
      .returning(),
  );

  const linkedArtists = options.artists ?? [await createArtist(db)];
  if (linkedArtists.length > 0) {
    await db.insert(trackArtists).values(
      linkedArtists.map((artist) => ({
        trackId: track.id,
        artistId: artist.id,
      })),
    );
  }

  const thumbnailValues = (options.thumbnails ?? [{}]).map((thumbnail) => ({
    url: `https://i.ytimg.com/vi/${track.ytId}/hqdefault.jpg`,
    width: 480,
    height: 360,
    ...thumbnail,
    trackId: track.id,
  }));
  const createdThumbnails =
    thumbnailValues.length > 0
      ? await db.insert(thumbnails).values(thumbnailValues).returning()
      : [];

  const noteValues = (options.notes ?? []).map((note, index) => ({
    note: 'A',
    octave: 4,
    start: index * 0.5,
    end: index * 0.5 + 0.5,
    frequencyMean: 440,
    ...note,
    trackId: track.id,
  }));
  const createdNotes =
    noteValues.length > 0
      ? await db.insert(trackNotes).values(noteValues).returning()
      : [];

  return {
    track,
    artists: linkedArtists,
    thumbnails: createdThumbnails,
    notes: createdNotes,
  };
};

/** Password every factory-made credential account gets by default. */
export const DEFAULT_PASSWORD = 'correct-horse-battery';

/** A verified user (`user-1@example.com`, `user_1`) without sign-in methods. */
export const createUser = (
  db: Database,
  overrides: Partial<NewUser> = {},
): Promise<User> => {
  const n = next('user');
  return insertOne(
    db
      .insert(users)
      .values({
        name: `User ${n}`,
        email: `user-${n}@example.com`,
        emailVerified: true,
        username: `user_${n}`,
        ...overrides,
      })
      .returning(),
  );
};

export type CreateCredentialAccountOptions = {
  /** Defaults to {@link DEFAULT_PASSWORD}. */
  password?: string;
  /**
   * Stores a `$2a$` bcrypt hash, like the accounts imported from the legacy
   * app, instead of Better Auth's scrypt.
   */
  legacyBcrypt?: boolean;
};

// bcryptjs only generates `$2b$`; legacy hashes are `$2a$`, the same
// algorithm under the older prefix (bcryptjs verifies both).
const legacyBcryptHash = async (password: string): Promise<string> =>
  (await bcrypt.hash(password, 4)).replace(/^\$2b\$/, '$2a$');

/** The email/password sign-in method of a user (Better Auth `credential`). */
export const createCredentialAccount = async (
  db: Database,
  user: User,
  options: CreateCredentialAccountOptions = {},
): Promise<Account> => {
  const password = options.password ?? DEFAULT_PASSWORD;
  return insertOne(
    db
      .insert(accounts)
      .values({
        providerId: 'credential',
        accountId: user.id,
        userId: user.id,
        password: options.legacyBcrypt
          ? await legacyBcryptHash(password)
          : await hashPassword(password),
      })
      .returning(),
  );
};

/** A {@link createUser} who can sign in with {@link DEFAULT_PASSWORD}. */
export const createPasswordUser = async (
  db: Database,
  overrides: Partial<NewUser> = {},
): Promise<User> => {
  const user = await createUser(db, overrides);
  await createCredentialAccount(db, user);
  return user;
};
