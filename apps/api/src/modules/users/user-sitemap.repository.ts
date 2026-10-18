import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, gt, isNotNull } from 'drizzle-orm';
import type { SitemapRow } from '../../common/sitemap/sitemap-page.js';
import type { DatabaseAdapter } from '../../database/database.js';
import { users } from '../../database/schema/users.js';

/** The Users with a Username, so a Profile to list, in ID order. */
@Injectable()
export class UserSitemapRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Up to `limit` listed Users with an ID after `after`, in ID order. */
  listAfter(options: {
    after: string | undefined;
    limit: number;
  }): Promise<SitemapRow[]> {
    const { after, limit } = options;
    return this.txHost.tx
      .select({ id: users.id, updatedAt: users.updatedAt })
      .from(users)
      .where(
        and(isNotNull(users.username), after ? gt(users.id, after) : undefined),
      )
      .orderBy(asc(users.id))
      .limit(limit);
  }
}
