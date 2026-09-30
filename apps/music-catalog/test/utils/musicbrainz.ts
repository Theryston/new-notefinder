import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '../../src/database/database.js';

// A small MusicBrainz fixture for the e2e specs: rows written with plain SQL,
// the way a dump or a replication packet would write them, into the schema
// that mbslave's scripts created (test/setup/musicbrainz-schema.ts). Plain SQL
// (not the service's own Drizzle tables) so a wrong column name in the
// service's read-only declarations fails a spec instead of passing twice.
//
// Every helper takes the database first and returns what later rows refer to.
// Ids are the serials the database hands out; `resetMusicBrainz` restarts them
// in every test.

/** The Nth MBID of a readable series: `mbid(7)` is `...-000000000007`. */
export const mbid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Every table the helpers below write to, emptied by `resetMusicBrainz`.
const FIXTURE_TABLES = [
  'area',
  'artist',
  'artist_alias',
  'artist_credit',
  'artist_credit_name',
  'artist_tag',
  'country_area',
  'genre',
  'iso_3166_1',
  'isrc',
  'l_recording_url',
  'l_recording_work',
  'link',
  'link_type',
  'medium',
  'recording',
  'recording_gid_redirect',
  'recording_tag',
  'release',
  'release_country',
  'release_group',
  'release_group_primary_type',
  'release_group_tag',
  'release_status',
  'release_unknown_country',
  'tag',
  'track',
  'url',
  'work',
] as const;

/** Empties the tables the fixture writes to and restarts their serials. */
export const resetMusicBrainz = async (db: Database): Promise<void> => {
  const tables = FIXTURE_TABLES.map(
    (table) => sql`${sql.identifier('musicbrainz')}.${sql.identifier(table)}`,
  );
  await db.execute(
    sql`truncate table ${sql.join(tables, sql`, `)} restart identity`,
  );
};

type Row = Record<string, unknown>;

const insertSql = (table: string, row: Row) => {
  const columns = Object.keys(row).map((column) => sql.identifier(column));
  const values = Object.values(row).map((value) => sql`${value}`);
  return sql`insert into ${sql.identifier('musicbrainz')}.${sql.identifier(table)}
    (${sql.join(columns, sql`, `)}) values (${sql.join(values, sql`, `)})`;
};

/** Inserts a row of a table that has no `id` (links, tags, events). */
export const insertRow = async (
  db: Database,
  table: string,
  row: Row,
): Promise<void> => {
  await db.execute(insertSql(table, row));
};

/** Inserts a row and returns the serial `id` the database gave it. */
export const insertRowWithId = async (
  db: Database,
  table: string,
  row: Row,
): Promise<number> => {
  const result = await db.execute<{ id: number }>(
    sql`${insertSql(table, row)} returning id`,
  );
  const id = result.rows[0]?.id;
  if (id === undefined) {
    throw new Error(`Inserting into ${table} returned no id`);
  }
  return id;
};

/** The id of the row of `table` named `name`, created when missing. */
export const ensureNamed = async (
  db: Database,
  table: string,
  name: string,
  extra: Row = {},
): Promise<number> => {
  const found = await db.execute<{ id: number }>(
    sql`select id from ${sql.identifier('musicbrainz')}.${sql.identifier(table)}
      where name = ${name} limit 1`,
  );
  return (
    found.rows[0]?.id ?? (await insertRowWithId(db, table, { name, ...extra }))
  );
};

export type FixtureArtist = { id: number; mbid: string; name: string };

export const addArtist = async (
  db: Database,
  input: { name: string; mbid?: string; sortName?: string },
): Promise<FixtureArtist> => {
  const artistMbid = input.mbid ?? randomUUID();
  const id = await insertRowWithId(db, 'artist', {
    gid: artistMbid,
    name: input.name,
    sort_name: input.sortName ?? input.name,
  });
  return { id, mbid: artistMbid, name: input.name };
};

type CreditedArtist = {
  artist: FixtureArtist;
  /** The name it is credited under; the artist's own name when left out. */
  creditedName?: string;
  /** Text between this artist and the next one. */
  joinPhrase?: string;
};

/** An artist credit whose printed name joins the credited names in order. */
const addArtistCredit = async (
  db: Database,
  artists: readonly CreditedArtist[],
): Promise<number> => {
  const entries = artists.map((entry) => ({
    artist: entry.artist.id,
    name: entry.creditedName ?? entry.artist.name,
    joinPhrase: entry.joinPhrase ?? '',
  }));
  const id = await insertRowWithId(db, 'artist_credit', {
    gid: randomUUID(),
    name: entries.map((entry) => entry.name + entry.joinPhrase).join(''),
    artist_count: entries.length,
  });
  for (const [position, entry] of entries.entries()) {
    await insertRow(db, 'artist_credit_name', {
      artist_credit: id,
      position,
      artist: entry.artist,
      name: entry.name,
      join_phrase: entry.joinPhrase,
    });
  }
  return id;
};

export type FixtureRecording = {
  id: number;
  mbid: string;
  artistCredit: number;
};

export type RecordingInput = {
  name: string;
  /** The artists credited on it; one artist named like the recording if left out. */
  artists?: readonly CreditedArtist[];
  mbid?: string;
  lengthMs?: number;
  disambiguation?: string;
  video?: boolean;
};

export const addRecording = async (
  db: Database,
  input: RecordingInput,
): Promise<FixtureRecording> => {
  const artists = input.artists ?? [
    { artist: await addArtist(db, { name: `Artist of ${input.name}` }) },
  ];
  const artistCredit = await addArtistCredit(db, artists);
  const recordingMbid = input.mbid ?? randomUUID();
  const id = await insertRowWithId(db, 'recording', {
    gid: recordingMbid,
    name: input.name,
    artist_credit: artistCredit,
    length: input.lengthMs ?? null,
    comment: input.disambiguation ?? '',
    video: input.video ?? false,
  });
  return { id, mbid: recordingMbid, artistCredit };
};

/** Makes `oldMbid` an MBID MusicBrainz merged into the given Recording. */
export const addRecordingRedirect = async (
  db: Database,
  oldMbid: string,
  into: FixtureRecording,
): Promise<void> => {
  await insertRow(db, 'recording_gid_redirect', {
    gid: oldMbid,
    new_id: into.id,
  });
};

export const addIsrc = async (
  db: Database,
  recording: FixtureRecording,
  isrc: string,
): Promise<void> => {
  await insertRow(db, 'isrc', { recording: recording.id, isrc });
};

/** Deletes the Recording's own row, the way a replicated delete does. */
export const deleteRecording = async (
  db: Database,
  recording: FixtureRecording,
): Promise<void> => {
  await db.execute(
    sql`delete from musicbrainz.recording where id = ${recording.id}`,
  );
};
