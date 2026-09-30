import { createDatabase, createPool } from './database.js';
import { bootstrapState } from './schema/bootstrap-state.js';

const URL = 'postgres://user:pass@db.internal:5433/catalog';

describe('createPool', () => {
  it('reports an error on an idle connection instead of crashing the process', async () => {
    const onError = vi.fn();
    const pool = createPool(URL, onError);
    const error = new Error(
      'terminating connection due to administrator command',
    );

    pool.emit('error', error);

    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    await pool.end();
  });

  it('connects to the given database', async () => {
    const pool = createPool(URL, vi.fn());

    expect(pool.options).toMatchObject({ connectionString: URL });
    await pool.end();
  });
});

describe('createDatabase', () => {
  it('maps camelCase fields to snake_case columns, as the migrations do', async () => {
    const pool = createPool(URL, vi.fn());
    const db = createDatabase(pool);

    const { sql } = db
      .select({ updatedAt: bootstrapState.updatedAt })
      .from(bootstrapState)
      .toSQL();

    expect(sql).toContain('"updated_at"');
    await pool.end();
  });
});
