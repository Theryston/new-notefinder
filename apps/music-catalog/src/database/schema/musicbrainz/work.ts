import { integer, uuid, varchar } from 'drizzle-orm/pg-core';
import { musicbrainz } from './musicbrainz-schema.js';

export const work = musicbrainz.table('work', {
  id: integer().notNull(),
  gid: uuid().notNull(),
  name: varchar().notNull(),
});

/** Recording (`entity0`) to Work (`entity1`) relationships. */
export const lRecordingWork = musicbrainz.table('l_recording_work', {
  entity0: integer().notNull(),
  entity1: integer().notNull(),
});
