import bcrypt from 'bcryptjs';
import type { Database } from '../../src/database/database.js';
import {
  artists,
  legacyArtistIds,
  trackArtists,
} from '../../src/database/schema/artists.js';
import { accounts } from '../../src/database/schema/auth.js';
import {
  trackExternalLinks,
  trackReleases,
  tracks,
  trackTags,
  trackWorks,
} from '../../src/database/schema/tracks.js';
import { users } from '../../src/database/schema/users.js';
import { hashPassword } from '../../src/modules/auth/password.js';

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type Artist = typeof artists.$inferSelect;
export type TrackRelease = typeof trackReleases.$inferSelect;
export type TrackWork = typeof trackWorks.$inferSelect;
export type TrackTag = typeof trackTags.$inferSelect;
export type TrackExternalLink = typeof trackExternalLinks.$inferSelect;

type NewUser = typeof users.$inferInsert;
type NewTrack = typeof tracks.$inferInsert;
type NewArtist = typeof artists.$inferInsert;
type NewTrackRelease = typeof trackReleases.$inferInsert;
type NewTrackWork = typeof trackWorks.$inferInsert;
type NewTrackTag = typeof trackTags.$inferInsert;
type NewTrackExternalLink = typeof trackExternalLinks.$inferInsert;

// Per-entity counters make default values unique and predictable within a
// spec ("User 1", "User 2", …). `resetDatabase` restarts them.
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

/** Deterministic version-4 UUIDs for seeded recording references. */
export const testMbid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A processed Track for the n-th test Recording (`testMbid(n)`). */
export const createTrack = (
  db: Database,
  overrides: Partial<NewTrack> = {},
): Promise<Track> => {
  const n = next('track');
  return insertOne(
    db
      .insert(tracks)
      .values({
        recordingMbid: testMbid(n),
        title: `Track ${n}`,
        lengthMs: 180_000 + n * 1_000,
        disambiguation: '',
        video: false,
        isrcs: [`USRC${String(n).padStart(9, '0')}`],
        genres: ['rock'],
        ...overrides,
      })
      .returning(),
  );
};

/** A catalog Artist with display fields the header needs. */
export const createArtist = (
  db: Database,
  overrides: Partial<NewArtist> = {},
): Promise<Artist> => {
  const n = next('artist');
  return insertOne(
    db
      .insert(artists)
      .values({
        mbid: testMbid(1000 + n),
        name: `Artist ${n}`,
        genres: ['rock', 'pop'],
        ...overrides,
      })
      .returning(),
  );
};

/** A legacy ID pointing at an Artist, for the redirect path. */
export const createLegacyArtistId = (
  db: Database,
  artistId: string,
  legacyId: string,
): Promise<void> => {
  return insertOne(
    db.insert(legacyArtistIds).values({ legacyId, artistId }).returning(),
  ).then(() => undefined);
};

/** Links a processed Track to an Artist, counting toward `trackCount`. */
export const linkTrackArtist = (
  db: Database,
  trackId: string,
  artistId: string,
): Promise<void> => {
  return insertOne(
    db.insert(trackArtists).values({ trackId, artistId }).returning(),
  ).then(() => undefined);
};

/** A release a Track's Recording appears on, for the expandable section. */
export const createTrackRelease = (
  db: Database,
  trackId: string,
  overrides: Partial<NewTrackRelease> = {},
): Promise<TrackRelease> => {
  const n = next('track-release');
  return insertOne(
    db
      .insert(trackReleases)
      .values({
        trackId,
        mbid: testMbid(2000 + n),
        title: `Release ${n}`,
        year: 1975 + (n % 50),
        coverArtUrl: `https://coverartarchive.org/release/${testMbid(2000 + n)}/front-500`,
        ...overrides,
      })
      .returning(),
  );
};

/** A work a Track's Recording links to, for the expandable section. */
export const createTrackWork = (
  db: Database,
  trackId: string,
  overrides: Partial<NewTrackWork> = {},
): Promise<TrackWork> => {
  const n = next('track-work');
  return insertOne(
    db
      .insert(trackWorks)
      .values({
        trackId,
        mbid: testMbid(3000 + n),
        title: `Work ${n}`,
        ...overrides,
      })
      .returning(),
  );
};

/** A tag of a Track's Recording, for the expandable section. */
export const createTrackTag = (
  db: Database,
  trackId: string,
  overrides: Partial<NewTrackTag> = {},
): Promise<TrackTag> => {
  const n = next('track-tag');
  return insertOne(
    db
      .insert(trackTags)
      .values({
        trackId,
        name: `tag-${n}`,
        count: 10 + n,
        ...overrides,
      })
      .returning(),
  );
};

/** An external URL of a Track's Recording, for the expandable section. */
export const createTrackExternalLink = (
  db: Database,
  trackId: string,
  overrides: Partial<NewTrackExternalLink> = {},
): Promise<TrackExternalLink> => {
  const n = next('track-link');
  return insertOne(
    db
      .insert(trackExternalLinks)
      .values({
        trackId,
        url: `https://musicbrainz.org/recording/${testMbid(4000 + n)}`,
        linkType: 'musicbrainz',
        ...overrides,
      })
      .returning(),
  );
};
