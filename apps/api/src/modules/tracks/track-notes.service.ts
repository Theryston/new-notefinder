import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { NoteSpan } from './track-note-span.js';
import { noteSummaryOf } from './track-note-summary.js';
import { TrackNotesRepository } from './track-notes.repository.js';
import { TracksRepository } from './tracks.repository.js';

/** The vocal notes of a Track and what the Track keeps of them. */
@Injectable()
export class TrackNotesService {
  constructor(
    private readonly notes: TrackNotesRepository,
    private readonly tracks: TracksRepository,
  ) {}

  /**
   * Replaces the Track's notes and the vocal range and key it keeps of them
   * (all cleared when there are none), together: inside the caller's
   * transaction when there is one, else in a transaction of its own.
   */
  @Transactional()
  async replaceNotes(
    trackId: string,
    notes: readonly NoteSpan[],
  ): Promise<void> {
    await this.notes.replaceNotes(trackId, notes);
    await this.tracks.setNoteSummary(trackId, noteSummaryOf(notes));
  }
}
