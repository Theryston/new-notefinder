import { sql } from 'drizzle-orm';
import { inject } from 'vitest';
import { createDatabase, createPool } from '../src/database/database.js';
import { withStatementTimeout } from '../src/database/with-statement-timeout.js';

describe('search readiness database reads', () => {
  it('bounds a stalled query so the database pool can close', async () => {
    const pool = createPool(inject('databaseUrl'), () => undefined);
    const db = createDatabase(pool);

    try {
      const startedAt = Date.now();
      await expect(
        withStatementTimeout(db, 5000, (transaction) =>
          transaction.execute(sql`select pg_sleep(30)`),
        ),
      ).rejects.toMatchObject({ cause: { code: '57014' } });
      expect(Date.now() - startedAt).toBeLessThan(8000);
    } finally {
      await pool.end();
    }
  }, 12_000);
});
