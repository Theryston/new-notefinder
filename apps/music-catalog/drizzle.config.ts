import { defineConfig } from 'drizzle-kit';

// No database credentials: `db:generate` (and CI's `drizzle-kit check`) only
// diffs the schema against the committed snapshots. Migrations are applied by
// src/database/migrate.ts, which reads the env module.
export default defineConfig({
  dialect: 'postgresql',
  // One file per table; there is no schema/index.ts because nothing needs
  // the schema as a single module.
  schema: './src/database/schema/*.ts',
  out: './drizzle',
  // Must match the runtime client in src/database/database.ts.
  casing: 'snake_case',
  // Only our own schema: the MusicBrainz ones belong to mbslave.
  schemaFilter: ['music_catalog'],
  strict: true,
  verbose: true,
});
