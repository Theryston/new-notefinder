import { Test, type TestingModule } from '@nestjs/testing';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { DATABASE, DATABASE_POOL, type DatabaseAdapter } from './database.js';
import { DatabaseModule } from './database.module.js';

// Stand-ins for the Drizzle client and pool, so the wiring can be checked
// without a database: `transaction` hands the callback a distinct `tx` object.
const tx = { name: 'tx' };
const db = {
  name: 'db',
  transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
    callback(tx),
  ),
};
const pool = { end: vi.fn(async () => {}) };

class ProbeService {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  client(): unknown {
    return this.txHost.tx;
  }

  @Transactional()
  async clientInTransaction(): Promise<unknown> {
    return this.txHost.tx;
  }

  @Transactional()
  async failInTransaction(): Promise<never> {
    throw new Error('boom');
  }
}

describe('DatabaseModule', () => {
  let moduleRef: TestingModule;
  let probe: ProbeService;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleRef = await Test.createTestingModule({ imports: [DatabaseModule] })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    await moduleRef.init();
    probe = new ProbeService(moduleRef.get(TransactionHost));
  });

  it('exposes the Drizzle client outside a transaction', () => {
    expect(probe.client()).toBe(db);
    expect(moduleRef.get(DATABASE)).toBe(db);
  });

  it('runs @Transactional() methods on the transaction client', async () => {
    await expect(probe.clientInTransaction()).resolves.toBe(tx);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('propagates errors so the transaction rolls back', async () => {
    await expect(probe.failInTransaction()).rejects.toThrowError('boom');
  });

  it('closes the pool on shutdown', async () => {
    await moduleRef.close();
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
