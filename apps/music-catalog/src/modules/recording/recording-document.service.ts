import type { RecordingDocument } from '../../lib/recordings-index.js';
import { buildDocuments } from './recording-document.js';
import type { RecordingDocumentRepository } from './recording-document.repository.js';
import type {
  BatchDetails,
  DocumentRecordingRow,
} from './recording-document-data.js';

export type DocumentBatch = {
  documents: RecordingDocument[];
  /** The id to continue after to get the batch that follows this one. */
  lastRecordingId: number;
};

/**
 * Describes Recordings for the search index, for the worker. Other modules
 * (indexing) use the catalog's Recordings through this service.
 */
export class RecordingDocumentService {
  constructor(private readonly repository: RecordingDocumentRepository) {}

  /**
   * The documents of the next `limit` Recordings after `afterId` (MusicBrainz's
   * integer id, the order Recordings are walked in), or undefined when there
   * are none left. All the batch is read with one query per kind of data.
   */
  async findBatch(
    afterId: number,
    limit: number,
  ): Promise<DocumentBatch | undefined> {
    const rows = await this.repository.findBatch(afterId, limit);
    const last = rows.at(-1);
    if (last === undefined) {
      return undefined;
    }
    const details = await this.loadDetails(rows);
    return {
      documents: buildDocuments(rows, details),
      lastRecordingId: last.id,
    };
  }

  private async loadDetails(
    rows: readonly DocumentRecordingRow[],
  ): Promise<BatchDetails> {
    const recordingIds = rows.map((row) => row.id);
    const artistCreditIds = [...new Set(rows.map((row) => row.artistCreditId))];
    const [
      artistNames,
      releaseTitles,
      workTitles,
      recording,
      releaseGroup,
      artist,
    ] = await Promise.all([
      this.repository.findArtistNames(artistCreditIds),
      this.repository.findReleaseTitles(recordingIds),
      this.repository.findWorkTitles(recordingIds),
      this.repository.findRecordingGenres(recordingIds),
      this.repository.findReleaseGroupGenres(recordingIds),
      this.repository.findArtistGenres(artistCreditIds),
    ]);
    return {
      artistNames,
      releaseTitles,
      workTitles,
      genres: { recording, releaseGroup, artist },
    };
  }
}
