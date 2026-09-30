import type { RecordingSummary } from '@notefinder/contracts';
import { assembleSummary } from './assemble-summary.js';
import type { RecordingSummaryRepository } from './recording-summary.repository.js';

/**
 * Describes Recordings as a search result lists them. Other modules (search)
 * use the catalog's Recordings through this service.
 */
export class RecordingSummaryService {
  constructor(private readonly repository: RecordingSummaryRepository) {}

  /**
   * The summaries of the Recordings with these MBIDs, in no particular order,
   * read with one query whatever their number. An MBID that is no Recording
   * in the database is left out.
   */
  async findByMbids(mbids: readonly string[]): Promise<RecordingSummary[]> {
    if (mbids.length === 0) {
      return [];
    }
    const rows = await this.repository.findByMbids(mbids);
    return rows.map(assembleSummary);
  }
}
