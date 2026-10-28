import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { RecordAcquisitionBody } from '@vozzify/contracts';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { userAcquisitions } from '../../database/schema/user-acquisitions.js';
import { users } from '../../database/schema/users.js';

export type RecordAcquisitionResult =
  | 'recorded'
  | 'missing'
  | 'old'
  | 'duplicate';

@Injectable()
export class AcquisitionRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Locks the User so concurrent first-load requests can only attach once. */
  async record(
    userId: string,
    acquisition: RecordAcquisitionBody,
    createdSince: Date,
  ): Promise<RecordAcquisitionResult> {
    const [user] = await this.txHost.tx
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    if (user === undefined) return 'missing';
    if (user.createdAt < createdSince) return 'old';

    const [row] = await this.txHost.tx
      .insert(userAcquisitions)
      .values({
        userId,
        firstTouch: acquisition.firstTouch,
        lastTouch: acquisition.lastTouch,
      })
      .onConflictDoNothing({ target: userAcquisitions.userId })
      .returning({ id: userAcquisitions.id });
    if (row === undefined) return 'duplicate';

    await this.txHost.tx
      .update(users)
      .set({ visitorId: acquisition.visitorId })
      .where(eq(users.id, userId));
    return 'recorded';
  }
}
