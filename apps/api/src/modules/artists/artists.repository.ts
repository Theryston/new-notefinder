import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { artists } from '../../database/schema/artists.js';

export type ArtistRow = { id: string; name: string };

@Injectable()
export class ArtistsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findById(id: string): Promise<ArtistRow | undefined> {
    const [row] = await this.txHost.tx
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(eq(artists.id, id))
      .limit(1);
    return row;
  }
}
