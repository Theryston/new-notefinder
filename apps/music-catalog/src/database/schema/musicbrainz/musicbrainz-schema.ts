import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * The Postgres schema mbslave restores the MusicBrainz tables into. They are
 * mbslave's, not ours: declared here by hand, read-only, never migrated (the
 * folder is outside drizzle.config.ts's glob). A table or column is declared
 * when a query needs it, with the name and type of the published schema
 * (mbslave's CreateTables.sql at the pinned tag).
 */
export const musicbrainz = pgSchema('musicbrainz');
