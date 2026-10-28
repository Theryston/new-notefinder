import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TrackKeyMode } from '@vozzify/contracts';
import { count, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { artists, trackArtists } from '../../database/schema/artists.js';
import { trackNotes } from '../../database/schema/track-notes.js';
import { trackViews } from '../../database/schema/track-views.js';
import {
  type StoredArtistCreditEntry,
  tracks,
} from '../../database/schema/tracks.js';

/** The Track fields the practice header shows, besides its Contributors. */
export type TrackPracticeRow = {
  id: string;
  title: string;
  coverUrl: string | null;
  artistCredit: StoredArtistCreditEntry[];
  lengthMs: number | null;
  youtubeVideoId: string | null;
  /** The Artists the Track is linked to, which the credit names link to. */
  artists: { id: string; mbid: string }[];
  hasNotes: boolean;
  viewCount: number;
  vocalRangeLowest: number | null;
  vocalRangeHighest: number | null;
  keyTonic: number | null;
  keyMode: TrackKeyMode | null;
};

/** A stored note. */
export type StoredNote = {
  pitch: number;
  start: number;
  end: number;
};

/** What the practice page reads of a Track. */
@Injectable()
export class TrackPracticeRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** The practice header of a Track, or undefined for an unknown ID. */
  async findPracticeRow(
    trackId: string,
  ): Promise<TrackPracticeRow | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: tracks.id,
        title: tracks.title,
        coverUrl: tracks.coverUrl,
        artistCredit: tracks.artistCredit,
        lengthMs: tracks.lengthMs,
        youtubeVideoId: tracks.youtubeVideoId,
        vocalRangeLowest: tracks.vocalRangeLowest,
        vocalRangeHighest: tracks.vocalRangeHighest,
        keyTonic: tracks.keyTonic,
        keyMode: tracks.keyMode,
      })
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);
    if (row === undefined) {
      return undefined;
    }
    const [linked, firstNote, views] = await Promise.all([
      this.txHost.tx
        .select({ id: artists.id, mbid: artists.mbid })
        .from(trackArtists)
        .innerJoin(artists, eq(trackArtists.artistId, artists.id))
        .where(eq(trackArtists.trackId, trackId)),
      this.txHost.tx
        .select({ id: trackNotes.id })
        .from(trackNotes)
        .where(eq(trackNotes.trackId, trackId))
        .limit(1),
      this.txHost.tx
        .select({ total: count() })
        .from(trackViews)
        .where(eq(trackViews.trackId, trackId)),
    ]);
    return {
      ...row,
      artists: linked,
      hasNotes: firstNote.length > 0,
      viewCount: views[0]?.total ?? 0,
    };
  }

  /** The Track's vocal notes in the order they are sung. */
  findNotes(trackId: string): Promise<StoredNote[]> {
    return this.txHost.tx
      .select({
        pitch: trackNotes.pitch,
        start: trackNotes.start,
        end: trackNotes.end,
      })
      .from(trackNotes)
      .where(eq(trackNotes.trackId, trackId))
      .orderBy(trackNotes.start, trackNotes.end);
  }
}
