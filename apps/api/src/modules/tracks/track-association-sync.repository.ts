import { Inject, Injectable } from '@nestjs/common';
import { asc, gt } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.js';
import { tracks } from '../../database/schema/tracks.js';

export type TrackAssociationSyncRow = { id: string; recordingMbid: string };

@Injectable()
export class TrackAssociationSyncRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findPage(
    afterId: string | undefined,
    limit: number,
  ): Promise<TrackAssociationSyncRow[]> {
    return this.db
      .select({ id: tracks.id, recordingMbid: tracks.recordingMbid })
      .from(tracks)
      .where(afterId ? gt(tracks.id, afterId) : undefined)
      .orderBy(asc(tracks.id))
      .limit(limit);
  }
}
