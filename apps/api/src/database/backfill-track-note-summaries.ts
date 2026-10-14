import { asc, eq, isNull } from 'drizzle-orm';
import { noteSummaryOf } from '../modules/tracks/track-note-summary.js';
import type { Database } from './database.js';
import { trackNotes } from './schema/track-notes.js';
import { tracks } from './schema/tracks.js';

/**
 * Fills the vocal range and the key of the Tracks that have notes but no
 * summary yet: the Tracks completed before the columns existed. Idempotent, so
 * it runs after every migration and only touches what is still missing.
 * Returns how many Tracks it filled.
 */
export async function backfillTrackNoteSummaries(
  db: Database,
): Promise<number> {
  const pending = await db
    .selectDistinct({ id: trackNotes.trackId })
    .from(trackNotes)
    .innerJoin(tracks, eq(tracks.id, trackNotes.trackId))
    .where(isNull(tracks.vocalRangeLowest));
  for (const { id } of pending) {
    const notes = await db
      .select({
        pitch: trackNotes.pitch,
        start: trackNotes.start,
        end: trackNotes.end,
      })
      .from(trackNotes)
      .where(eq(trackNotes.trackId, id))
      .orderBy(asc(trackNotes.start));
    await db.update(tracks).set(noteSummaryOf(notes)).where(eq(tracks.id, id));
  }
  return pending.length;
}
