import type { DatabaseSync } from 'node:sqlite';

/**
 * The part of the LRCLIB dump the importer reads: the dump is a SQLite file
 * whose schema drifts between dumps (the spike saw `user_version` move), so
 * the importer checks it and fails with a clear error instead of reading the
 * wrong columns. Only these tables and columns are read; anything else the
 * dump holds (its FTS table, `lyricsfile`, ...) is ignored.
 */
const TRACK_TABLE = 'tracks';
const LYRICS_TABLE = 'lyrics';

const REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  [TRACK_TABLE]: [
    'id',
    'name',
    'name_lower',
    'artist_name',
    'artist_name_lower',
    'album_name',
    'album_name_lower',
    'duration',
  ],
  [LYRICS_TABLE]: ['id', 'track_id', 'plain_lyrics', 'synced_lyrics'],
};

/** The dump's schema is not what the importer expects. */
export class LrclibSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LrclibSchemaError';
  }
}

const tableColumns = (db: DatabaseSync, table: string): Set<string> => {
  const rows = db
    .prepare(`PRAGMA table_info(${JSON.stringify(table)})`)
    .all() as unknown as { name: string }[];
  return new Set(rows.map((row) => row.name));
};

/**
 * Fails with an `LrclibSchemaError` naming the first missing table or column,
 * so a stale fake dump cannot hide a real schema change. Run on every dump,
 * fake ones included, right after opening it.
 */
export const assertLrclibSchema = (db: DatabaseSync): void => {
  const tableRows = (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as unknown as { name: string }[]
  ).map((row) => row.name);
  const tables = new Set(tableRows);
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!tables.has(table)) {
      throw new LrclibSchemaError(
        `LRCLIB dump schema mismatch: table "${table}" is missing`,
      );
    }
    const present = tableColumns(db, table);
    for (const column of columns) {
      if (!present.has(column)) {
        throw new LrclibSchemaError(
          `LRCLIB dump schema mismatch: table "${table}" is missing column "${column}"`,
        );
      }
    }
  }
};
