import { and, asc, eq, exists, isNull } from 'drizzle-orm';
import { noteSummaryOf } from '../modules/tracks/track-note-summary.js';
import type { Database } from './database.js';
import { trackNotes } from './schema/track-notes.js';
import { tracks } from './schema/tracks.js';

/**
 * Fills the vocal range and the key of the Tracks that have notes but no
 * summary yet: the Tracks completed before the columns existed. Idempotent, so
 * it runs after every migration and only touches what is still missing: the
 * pending Tracks are found from `tracks`, probing the notes' index, instead of
 * scanning every note. Each Track is written in its own transaction.
 * Returns how many Tracks it filled.
 */
export async function backfillTrackNoteSummaries(
  db: Database,
): Promise<number> {
  const pending = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(
      and(
        isNull(tracks.vocalRangeLowest),
        exists(
          db
            .select({ id: trackNotes.id })
            .from(trackNotes)
            .where(eq(trackNotes.trackId, tracks.id)),
        ),
      ),
    );
  for (const { id } of pending) {
    await db.transaction(async (tx) => {
      const notes = await tx
        .select({
          pitch: trackNotes.pitch,
          start: trackNotes.start,
          end: trackNotes.end,
        })
        .from(trackNotes)
        .where(eq(trackNotes.trackId, id))
        .orderBy(asc(trackNotes.start));
      await tx
        .update(tracks)
        .set(noteSummaryOf(notes))
        .where(eq(tracks.id, id));
    });
  }
  return pending.length;
}
