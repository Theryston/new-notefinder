import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackNotes } from '../../database/schema/track-notes.js';
import type { NoteSpan } from './track-note-span.js';

/** The vocal notes of Tracks (CONTEXT.md "Track"). */
@Injectable()
export class TrackNotesRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * Replaces the Track's notes with these. It joins the caller's transaction,
   * so the notes change together with the Processing that found them.
   */
  async replaceNotes(
    trackId: string,
    notes: readonly NoteSpan[],
  ): Promise<void> {
    await this.txHost.tx
      .delete(trackNotes)
      .where(eq(trackNotes.trackId, trackId));
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
