import type { RecordingLyrics } from '@notefinder/contracts';
import {
  type LyricsDocument,
  lyricsSearchText,
} from '../../lib/lyrics-index.js';
import type { LyricsRepository } from './lyrics.repository.js';

/**
 * The kept Lyrics of a Recording, for `getRecording`, and the documents the
 * indexing sends to the `lyrics` search index. Other modules (recording,
 * indexing) use the Lyrics only through this service.
 */
export class LyricsService {
  constructor(private readonly repository: LyricsRepository) {}

  /** Plain and synced Lyrics, both null when no Lyrics matched. */
  async getLyrics(mbid: string): Promise<RecordingLyrics> {
    const row = await this.repository.findByMbid(mbid);
    return { plain: row?.plain ?? null, synced: row?.synced ?? null };
  }

  /**
   * The index documents of the kept Lyrics of the next `limit` Recordings
   * after `afterId` (MusicBrainz's integer id, the order everything is walked
   * in). Recordings whose Lyrics hold no text are left out.
   */
  async findDocuments(
    afterId: number,
    limit: number,
  ): Promise<LyricsDocument[]> {
    const rows = await this.repository.findLyricsDocuments(afterId, limit);
    const documents: LyricsDocument[] = [];
    for (const row of rows) {
      const lyrics = lyricsSearchText(row.plain, row.synced);
      if (lyrics !== undefined) {
        documents.push({ mbid: row.mbid, lyrics });
      }
    }
    return documents;
  }
}
