import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackContributors } from '../../database/schema/track-contributors.js';

/** The Tracks a User contributed to. */
@Injectable()
export class TrackContributorPagesRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findTrackIdsOf(userId: string): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ trackId: trackContributors.trackId })
      .from(trackContributors)
      .where(eq(trackContributors.userId, userId));
    return rows.map((row) => row.trackId);
  }
}
