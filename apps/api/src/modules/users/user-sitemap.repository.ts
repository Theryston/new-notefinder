import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, gt, isNotNull, sql } from 'drizzle-orm';
import type { SitemapRow } from '../../common/sitemap/sitemap-page.js';
import type { DatabaseAdapter } from '../../database/database.js';
import { users } from '../../database/schema/users.js';

/** A listed User: the row, and the Username its Profile URL is built from. */
export type UserSitemapRow = SitemapRow & { username: string };

/** The Users with a Username, so a Profile to list, in ID order. */
@Injectable()
export class UserSitemapRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Up to `limit` listed Users with an ID after `after`, in ID order. */
  listAfter(options: {
    after: string | undefined;
    limit: number;
  }): Promise<UserSitemapRow[]> {
    const { after, limit } = options;
    return this.txHost.tx
      .select({
        id: users.id,
        updatedAt: users.updatedAt,
        // The filter below keeps only rows with a Username, so this is never null.
        username: sql<string>`${users.username}`,
      })
      .from(users)
      .where(
        and(isNotNull(users.username), after ? gt(users.id, after) : undefined),
      )
      .orderBy(asc(users.id))
      .limit(limit);
  }
}
