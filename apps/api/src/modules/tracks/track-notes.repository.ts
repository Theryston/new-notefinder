import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackNotes } from '../../database/schema/track-notes.js';
import { tracks } from '../../database/schema/tracks.js';
import { noteSummaryOf } from './track-note-summary.js';

/** A Vocal note to store: a MIDI pitch held from `start` to `end` (seconds). */
export type NoteToStore = { pitch: number; start: number; end: number };

/** The vocal notes of Tracks (CONTEXT.md "Track"). */
@Injectable()
export class TrackNotesRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * Replaces the Track's notes with these, and the vocal range and key the
   * Track keeps of them (all cleared when there are none). It joins the
   * caller's transaction, so they change together with the Processing that
   * found them.
   */
  async replaceNotes(
    trackId: string,
    notes: readonly NoteToStore[],
  ): Promise<void> {
    await this.txHost.tx
      .delete(trackNotes)
      .where(eq(trackNotes.trackId, trackId));
    await this.txHost.tx
      .update(tracks)
      .set(noteSummaryOf(notes))
      .where(eq(tracks.id, trackId));
    if (notes.length === 0) {
      return;
    }
    await this.txHost.tx.insert(trackNotes).values(
      notes.map((note) => ({
        trackId,
        pitch: note.pitch,
        start: note.start,
        end: note.end,
      })),
    );
  }
}
