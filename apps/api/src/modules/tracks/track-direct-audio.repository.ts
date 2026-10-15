import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, desc, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackProcessings } from '../../database/schema/track-processings.js';

@Injectable()
export class TrackDirectAudioRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findLatestCompleted(trackId: string) {
    const [row] = await this.txHost.tx
      .select({
        musicMp3Url: trackProcessings.musicMp3Url,
        vocalsMp3Url: trackProcessings.vocalsMp3Url,
      })
      .from(trackProcessings)
      .where(
        and(
          eq(trackProcessings.trackId, trackId),
          eq(trackProcessings.status, 'COMPLETED'),
        ),
      )
      .orderBy(desc(trackProcessings.createdAt), desc(trackProcessings.id))
      .limit(1);
    return row;
  }
}
