import { DatabaseSync } from 'node:sqlite';
import { assertLrclibSchema, LrclibSchemaError } from './lrclib-schema.js';

const withTables = (sql: string): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  return db;
};

const fullSchema = `
  CREATE TABLE tracks (id INTEGER PRIMARY KEY, name TEXT, name_lower TEXT,
    artist_name TEXT, artist_name_lower TEXT, album_name TEXT,
    album_name_lower TEXT, duration FLOAT, last_lyrics_id INTEGER,
    created_at TEXT, updated_at TEXT);
  CREATE TABLE lyrics (id INTEGER PRIMARY KEY, track_id INTEGER,
    plain_lyrics TEXT, synced_lyrics TEXT, has_plain_lyrics INTEGER,
    has_synced_lyrics INTEGER, instrumental INTEGER, source TEXT,
    created_at TEXT, updated_at TEXT, lyricsfile TEXT, has_lyricsfile INTEGER);
`;

describe('assertLrclibSchema', () => {
  it('accepts the expected tables and columns', () => {
    const db = withTables(fullSchema);

    expect(() => assertLrclibSchema(db)).not.toThrow();
    db.close();
  });

  it('fails with a clear error when a table is missing', () => {
    const db = withTables(
      'CREATE TABLE lyrics (id INTEGER, track_id INTEGER, plain_lyrics TEXT, synced_lyrics TEXT)',
    );

    expect(() => assertLrclibSchema(db)).toThrow(LrclibSchemaError);
    expect(() => assertLrclibSchema(db)).toThrow(
      'LRCLIB dump schema mismatch: table "tracks" is missing',
    );
    db.close();
  });

  it('fails with a clear error when a column drifted away', () => {
    const db = withTables(`
      CREATE TABLE tracks (id INTEGER, name TEXT, name_lower TEXT,
        artist_name TEXT, artist_name_lower TEXT, album_name TEXT,
        album_name_lower TEXT, duration FLOAT);
      CREATE TABLE lyrics (id INTEGER, track_id INTEGER, plain_lyrics TEXT);
    `);

    expect(() => assertLrclibSchema(db)).toThrow(
      'LRCLIB dump schema mismatch: table "lyrics" is missing column "synced_lyrics"',
    );
    db.close();
  });
});
