import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Mbid } from '@notefinder/contracts';
import { inArray } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { tracks } from '../../database/schema/tracks.js';

@Injectable()
export class TracksRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * Track ids keyed by recording MBID, for the MBIDs given. Only processed
   * Recordings have a row; the caller maps a miss to null (static card).
   */
  async findTrackIdsByRecordingMbids(
    mbids: Mbid[],
  ): Promise<Map<string, string>> {
    if (mbids.length === 0) {
      return new Map();
    }
    const rows = await this.txHost.tx
      .select({ id: tracks.id, recordingMbid: tracks.recordingMbid })
      .from(tracks)
      .where(inArray(tracks.recordingMbid, mbids));
    return new Map(rows.map((row) => [row.recordingMbid, row.id]));
  }
}
