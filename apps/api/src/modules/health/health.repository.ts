import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.js';

@Injectable()
export class HealthRepository {
  // The plain client, not TransactionHost: a connectivity probe must never
  // join a request's transaction.
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
