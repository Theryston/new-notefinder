import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { asc, gt } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { tracks } from '../../database/schema/tracks.js';

export type TrackAssociationSyncRow = { id: string; recordingMbid: string };

@Injectable()
export class TrackAssociationSyncRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  findPage(
    afterId: string | undefined,
    limit: number,
  ): Promise<TrackAssociationSyncRow[]> {
    return this.txHost.tx
      .select({ id: tracks.id, recordingMbid: tracks.recordingMbid })
      .from(tracks)
      .where(afterId ? gt(tracks.id, afterId) : undefined)
      .orderBy(asc(tracks.id))
      .limit(limit);
  }
}
