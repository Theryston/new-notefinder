import { bootstrapState } from '../src/database/schema/bootstrap-state.js';
import { useTestServer } from './utils/create-test-server.js';
import { resetDatabase, setBootstrapState } from './utils/database.js';

describe('bootstrap state table (e2e)', () => {
  const server = useTestServer();

  beforeEach(async () => {
    await resetDatabase(server().db);
  });

  it('starts a row in the restoring phase unless told otherwise', async () => {
    await server().db.insert(bootstrapState).values({ dataset: 'full' });

    const rows = await server().db.select().from(bootstrapState);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phase: 'restoring', dataset: 'full' });
  });

  it('holds a single row: writing again updates it', async () => {
    await setBootstrapState(server().db, {
      phase: 'restoring',
      dataset: 'tiny',
    });
    await setBootstrapState(server().db, { phase: 'ready', dataset: 'tiny' });

    const rows = await server().db.select().from(bootstrapState);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phase: 'ready' });
  });

  it('refuses a second row', async () => {
    await setBootstrapState(server().db, {
      phase: 'restoring',
      dataset: 'tiny',
    });

    await expect(
      server().db.insert(bootstrapState).values({ id: false, dataset: 'tiny' }),
    ).rejects.toThrow();
  });
});
