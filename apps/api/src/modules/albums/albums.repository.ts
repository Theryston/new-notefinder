import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { albums } from '../../database/schema/albums.js';

export type AlbumRow = { id: string; name: string };

@Injectable()
export class AlbumsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findById(id: string): Promise<AlbumRow | undefined> {
    const [row] = await this.txHost.tx
      .select({ id: albums.id, name: albums.name })
      .from(albums)
      .where(eq(albums.id, id))
      .limit(1);
    return row;
  }
}
