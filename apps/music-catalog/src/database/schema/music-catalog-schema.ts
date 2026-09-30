import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * The Postgres schema for everything this service owns. The MusicBrainz
 * tables it reads live in mbslave's own schemas and are never migrated here.
 */
export const musicCatalog = pgSchema('music_catalog');
