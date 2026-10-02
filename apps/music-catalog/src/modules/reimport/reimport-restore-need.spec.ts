import { needsParallelDatabaseWarning } from './reimport-restore.service.js';

// When the container warns the operator to configure the parallel database:
// a schema-change stall in `full` mode with nowhere to rebuild. Anything
// else stays quiet, so the warn never fires for ordinary replication
// failures or for deployments that already configured it.
describe('needsParallelDatabaseWarning', () => {
  it('warns on a schema-change stall without a parallel database', () => {
    expect(
      needsParallelDatabaseWarning({
        dataset: 'full',
        stallReason: 'schema-change',
        hasParallelDatabase: false,
      }),
    ).toBe(true);
  });

  it('stays quiet with a parallel database configured', () => {
    expect(
      needsParallelDatabaseWarning({
        dataset: 'full',
        stallReason: 'schema-change',
        hasParallelDatabase: true,
      }),
    ).toBe(false);
  });

  it('stays quiet without a schema-change stall', () => {
    expect(
      needsParallelDatabaseWarning({
        dataset: 'full',
        stallReason: undefined,
        hasParallelDatabase: false,
      }),
    ).toBe(false);
  });

  it('stays quiet outside full mode', () => {
    expect(
      needsParallelDatabaseWarning({
        dataset: 'tiny',
        stallReason: 'schema-change',
        hasParallelDatabase: false,
      }),
    ).toBe(false);
  });
});
