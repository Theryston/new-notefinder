import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  trackContributionKind,
  trackContributions,
  trackContributors,
} from '../../database/schema/track-contributors.js';
import { users } from '../../database/schema/users.js';
import type { TrackContributorCursor } from './track-contributor-cursor.js';

/** A Contribution's kind, as the schema stores it. */
export type TrackContributionKind =
  (typeof trackContributionKind.enumValues)[number];

/**
 * Contributors of Tracks and the Contributions they make. A Contributor is a
 * User on one Track; a Contribution is an action of one that started a
 * Processing. The Processing itself is in `TrackProcessingRepository`.
 */
@Injectable()
export class TrackContributorRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * The Contributor of a User on a Track, created by their first Contribution
   * to it; returns its ID. Concurrent first Contributions end in one row.
   */
  async findOrInsertContributor(
    trackId: string,
    userId: string,
  ): Promise<string> {
    const [inserted] = await this.txHost.tx
      .insert(trackContributors)
      .values({ trackId, userId })
      .onConflictDoNothing({
        target: [trackContributors.trackId, trackContributors.userId],
      })
      .returning({ id: trackContributors.id });
    if (inserted !== undefined) {
      return inserted.id;
    }
    const [existing] = await this.txHost.tx
      .select({ id: trackContributors.id })
      .from(trackContributors)
      .where(
        and(
          eq(trackContributors.trackId, trackId),
          eq(trackContributors.userId, userId),
        ),
      )
      .limit(1);
    if (existing === undefined) {
      throw new Error('Contributor vanished after its insert conflicted');
    }
    return existing.id;
  }

  /** Records one Contribution: an action of a Contributor that started a Processing. */
  async insertContribution(row: {
    contributorId: string;
    kind: TrackContributionKind;
    processingId: string;
  }): Promise<void> {
    await this.txHost.tx.insert(trackContributions).values(row);
  }

  /** The Contributors of a Track, in the order they first contributed. */
  findContributors(trackId: string): Promise<{ id: string; userId: string }[]> {
    return this.txHost.tx
      .select({ id: trackContributors.id, userId: trackContributors.userId })
      .from(trackContributors)
      .where(eq(trackContributors.trackId, trackId))
      .orderBy(asc(trackContributors.createdAt), asc(trackContributors.id));
  }

  /** Wildcards never reach the pattern: the match stays a plain substring. */
  private static searchPattern(query: string): string {
    return `%${query.replace(/[%_\\]/g, '')}%`;
  }

  private contributorFilters(
    trackId: string,
    cursor: TrackContributorCursor | undefined,
    query: string | undefined,
  ) {
    const conditions = [eq(trackContributors.trackId, trackId)];
    if (cursor !== undefined) {
      // Cursors carry millisecond ISO timestamps while the column stores
      // microseconds: truncate both sides, or a row repeats its own page.
      conditions.push(
        sql`(date_trunc('milliseconds', ${trackContributors.createdAt}), ${trackContributors.id}) > (${new Date(cursor.contributedAt)}, ${cursor.contributorId})`,
      );
    }
    if (query !== undefined) {
      const pattern = TrackContributorRepository.searchPattern(query);
      conditions.push(
        sql`(${users.username} ILIKE ${pattern} OR ${users.name} ILIKE ${pattern})`,
      );
    }
    return and(...conditions);
  }

  /**
   * One page of the Track's Contributors with their User's public fields, in
   * first-contribution order, plus how many match in total. `limit + 1` rows
   * decide whether a next page exists.
   */
  async findContributorsPage(
    trackId: string,
    options: {
      cursor?: TrackContributorCursor;
      limit: number;
      query?: string;
    },
  ): Promise<{
    rows: {
      id: string;
      username: string | null;
      name: string;
      image: string | null;
      contributedAt: Date;
    }[];
    total: number;
  }> {
    const { cursor, limit, query } = options;
    const where = this.contributorFilters(trackId, cursor, query);
    const [rows, [countRow]] = await Promise.all([
      this.txHost.tx
        .select({
          id: trackContributors.id,
          username: users.username,
          name: users.name,
          image: users.image,
          contributedAt: trackContributors.createdAt,
        })
        .from(trackContributors)
        .innerJoin(users, eq(users.id, trackContributors.userId))
        .where(where)
        .orderBy(asc(trackContributors.createdAt), asc(trackContributors.id))
        .limit(limit + 1),
      this.txHost.tx
        .select({ total: count() })
        .from(trackContributors)
        .innerJoin(users, eq(users.id, trackContributors.userId))
        .where(this.contributorFilters(trackId, undefined, query)),
    ]);
    return { rows, total: countRow?.total ?? 0 };
  }
}
