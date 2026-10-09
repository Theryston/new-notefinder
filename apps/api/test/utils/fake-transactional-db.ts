/**
 * A stand-in for the database and its pool, for unit specs of services whose
 * writes run in a `@Transactional()` method: the transaction runs on a
 * stand-in client, so the write path needs no database. Pass `db` and `pool`
 * to `overrideProvider(DATABASE)` and `overrideProvider(DATABASE_POOL)`.
 */
export const fakeTransactionalDatabase = () => {
  const tx = { name: 'tx' };
  const db = {
    name: 'db',
    transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
      callback(tx),
    ),
  };
  const pool = { end: vi.fn(async () => {}) };
  return { db, pool };
};
