import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { count, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  trackContributions,
  trackContributors,
} from '../../database/schema/track-contributors.js';
import { users } from '../../database/schema/users.js';

/**
 * The reads behind the Summary section that no other module owns: the
 * User a username names, and the Contributions a User made, across every
 * Track and kind (a Contribution belongs to a Contributor row, which names
 * the User, so the count joins through it).
 */
@Injectable()
export class ProfileSummaryRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** The ID of the User with this lowercase username, if any. */
  async findUserIdByUsername(username: string): Promise<string | undefined> {
    const [row] = await this.txHost.tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return row?.id;
  }

  async countContributions(userId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(trackContributions)
      .innerJoin(
        trackContributors,
        eq(trackContributors.id, trackContributions.contributorId),
      )
      .where(eq(trackContributors.userId, userId));
    return row?.value ?? 0;
  }
}
