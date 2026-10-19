import {
  type LyricsDocument,
  lyricsSearchText,
} from '../../lib/lyrics-index.js';
import type { LyricsRepository } from './lyrics.repository.js';

/**
 * The kept Lyrics, as the documents the indexing sends to the `lyrics` search
 * index. Other modules (indexing) use the Lyrics only through this service.
 */
export class LyricsService {
  constructor(private readonly repository: LyricsRepository) {}

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
