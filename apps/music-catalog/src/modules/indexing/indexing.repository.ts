import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import { indexingCheckpoint } from '../../database/schema/indexing-checkpoint.js';

export class IndexingRepository {
  constructor(private readonly db: Database) {}

  /** The last Recording sent to the index, or 0 when nothing was yet. */
  async getCheckpoint(indexUid: string): Promise<number> {
    const [checkpoint] = await this.db
      .select({ lastRecordingId: indexingCheckpoint.lastRecordingId })
      .from(indexingCheckpoint)
      .where(eq(indexingCheckpoint.indexUid, indexUid))
      .limit(1);
    return checkpoint?.lastRecordingId ?? 0;
  }

  async saveCheckpoint(
    indexUid: string,
    lastRecordingId: number,
  ): Promise<void> {
    await this.db
      .insert(indexingCheckpoint)
      .values({ indexUid, lastRecordingId })
      .onConflictDoUpdate({
        target: indexingCheckpoint.indexUid,
        set: { lastRecordingId, updatedAt: new Date() },
      });
  }
}
