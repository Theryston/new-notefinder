import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { userPracticePreferences } from '../../database/schema/user-practice-preferences.js';

/** A User's stored practice preferences, as the database keeps them. */
export type PracticePreferencesRow =
  typeof userPracticePreferences.$inferSelect;

@Injectable()
export class PracticePreferencesRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async find(userId: string): Promise<PracticePreferencesRow | undefined> {
    const [row] = await this.txHost.tx
      .select()
      .from(userPracticePreferences)
      .where(eq(userPracticePreferences.userId, userId))
      .limit(1);
    return row;
  }

  /** Writes the changed preferences, creating the row on the first change. */
  async upsert(
    userId: string,
    patch: Partial<Omit<PracticePreferencesRow, 'userId'>>,
  ): Promise<PracticePreferencesRow> {
    const [row] = await this.txHost.tx
      .insert(userPracticePreferences)
      .values({ userId, ...patch })
      .onConflictDoUpdate({
        target: userPracticePreferences.userId,
        set: patch,
      })
      .returning();
    if (!row) {
      throw new Error('Saving the practice preferences returned no row');
    }
    return row;
  }
}
