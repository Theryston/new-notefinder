import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/**
 * The mbslave release whose SQL scripts create the MusicBrainz schema in the
 * e2e database. It is the release the real deployment pins (the mbslave
 * container, schema sequence 31): bump both together when MusicBrainz changes
 * its schema.
 */
const MBSLAVE_REF = 'v31.0.1';

// The scripts `mbslave init --empty` runs to create the schema, in its order
// (docs/research/music-catalog-spike.md, section 3). Foreign keys are not
// among them: mbslave never creates them on a mirror.
const SCRIPTS = [
  'Extensions',
  'CreateSearchConfiguration',
  'CreateCollations',
  'CreateTypes',
  'CreateTables',
  'CreatePrimaryKeys',
  'CreateFunctions',
  'CreateIndexes',
] as const;

const SCRIPTS_URL = `https://raw.githubusercontent.com/acoustid/mbslave/${MBSLAVE_REF}/mbslave/sql`;
const DOWNLOAD_ATTEMPTS = 3;

// The scripts are not vendored: they come from musicbrainz-server, which is
// GPL licensed, so they are fetched from the pinned tag and kept in
// node_modules (ignored by git) to run offline afterwards.
const cacheDirectory = fileURLToPath(
  new URL(`../../node_modules/.cache/mbslave-${MBSLAVE_REF}/`, import.meta.url),
);

const download = async (name: string): Promise<string> => {
  const url = `${SCRIPTS_URL}/${name}.sql`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  const reason =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not download ${url} (${reason})`);
};

const loadScript = async (name: string): Promise<string> => {
  const path = `${cacheDirectory}${name}.sql`;
  try {
    return await readFile(path, 'utf8');
  } catch {
    const sql = await download(name);
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path, sql);
    return sql;
  }
};

// `\set ON_ERROR_STOP 1` is a psql command, not SQL, and the scripts have no
// other one. Without psql, a failing statement aborts the script anyway.
const withoutPsqlCommands = (sql: string): string =>
  sql
    .split('\n')
    .filter((line) => !line.startsWith('\\'))
    .join('\n');

const schemaExists = async (client: Client): Promise<boolean> => {
  const result = await client.query(
    "select to_regclass('musicbrainz.recording') is not null as present",
  );
  return result.rows[0]?.present === true;
};

/**
 * Creates the MusicBrainz schema (375 tables, empty) with mbslave's own
 * scripts, the way `mbslave init --empty` does: the `musicbrainz` schema,
 * then each script with `musicbrainz, public` as the search path (what
 * mbslave's `PGOPTIONS` does). Needs a superuser, for the contrib extensions.
 * Skips a database that already has it (a reused `E2E_DATABASE_URL`).
 */
export const applyMusicBrainzSchema = async (
  databaseUrl: string,
): Promise<void> => {
  const scripts = await Promise.all(SCRIPTS.map(loadScript));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    if (await schemaExists(client)) {
      return;
    }
    await client.query('create schema if not exists musicbrainz');
    await client.query('set search_path = musicbrainz, public');
    for (const script of scripts) {
      await client.query(withoutPsqlCommands(script));
    }
  } finally {
    await client.end();
  }
};
