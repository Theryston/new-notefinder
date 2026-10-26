import { createServer, type Socket } from 'node:net';
import { sql } from 'drizzle-orm';
import { inject } from 'vitest';
import { createDatabase, createPool } from '../src/database/database.js';
import { withStatementTimeout } from '../src/database/with-statement-timeout.js';

describe('search readiness database reads', () => {
  it('bounds connection acquisition before a database session exists', async () => {
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Could not read the stalled handshake server port');
    }
    const pool = createPool(
      `postgres://notefinder:unused@127.0.0.1:${address.port}/notefinder`,
      () => undefined,
    );
    const db = createDatabase(pool);

    try {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        withStatementTimeout(db, 200, async () => undefined).then(
          () => 'resolved' as const,
          () => 'rejected' as const,
        ),
        new Promise<'timed out'>((resolve) => {
          timeout = setTimeout(() => resolve('timed out'), 1500);
        }),
      ]);
      if (timeout !== undefined) clearTimeout(timeout);
      expect(result).toBe('rejected');
    } finally {
      for (const socket of sockets) socket.destroy();
      await pool.end();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }, 5000);

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

  it('discards a connection when a query response exceeds its deadline', async () => {
    const pool = createPool(inject('databaseUrl'), () => undefined);
    const db = createDatabase(pool);

    try {
      const startedAt = Date.now();
      await expect(
        withStatementTimeout(db, 1000, async (transaction) => {
          await transaction.execute(
            sql`select set_config('statement_timeout', '0', true)`,
          );
          return transaction.execute(sql`select pg_sleep(30)`);
        }),
      ).rejects.toThrow();
      expect(Date.now() - startedAt).toBeLessThan(3000);
    } finally {
      await pool.end();
    }
  }, 5000);
});
