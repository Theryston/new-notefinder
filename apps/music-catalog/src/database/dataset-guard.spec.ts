import type { Database } from './database.js';
import {
  assertSupportedDatasets,
  readRecordedDatasets,
} from './dataset-guard.js';

type ExecuteStub = (
  query: unknown,
) => Promise<{ rows: Array<{ dataset: string }> }>;

const stubDatabase = (execute: ExecuteStub): Database =>
  ({ execute }) as unknown as Database;

const supported: Array<[string[]]> = [
  [['full']],
  [['tiny']],
  [['full', 'tiny']],
  [[]],
];

describe('assertSupportedDatasets', () => {
  it.each(supported)('accepts the supported datasets %s', (datasets) => {
    expect(() => assertSupportedDatasets(datasets)).not.toThrow();
  });

  it('refuses the dropped sample dataset with where to go', () => {
    expect(() => assertSupportedDatasets(['sample'])).toThrow(
      /The catalog holds the removed sample dataset: reset the local database first \(see apps\/music-catalog\/AGENTS\.md "Resetting a local database"\)\. The sample dump was dropped by #85; datasets are now full and tiny\./,
    );
  });

  it('names every removed dataset it found', () => {
    expect(() => assertSupportedDatasets(['tiny', 'huge'])).toThrow(
      /removed huge dataset/,
    );
  });
});

describe('readRecordedDatasets', () => {
  it('reads the recorded datasets as text', async () => {
    const db = stubDatabase(async () => ({ rows: [{ dataset: 'tiny' }] }));

    await expect(readRecordedDatasets(db)).resolves.toEqual(['tiny']);
  });

  it('reads an empty list on a fresh database without a bootstrap table', async () => {
    // Shaped like what `db.execute` throws: Drizzle wraps the driver's
    // `42P01` on the cause of its own query error.
    const missingTable = Object.assign(
      new Error('Failed query: select dataset::text as dataset'),
      {
        cause: Object.assign(new Error('relation does not exist'), {
          code: '42P01',
        }),
      },
    );
    const db = stubDatabase(async () => {
      throw missingTable;
    });

    await expect(readRecordedDatasets(db)).resolves.toEqual([]);
  });

  it('lets any other database error through', async () => {
    const db = stubDatabase(async () => {
      throw new Error('connection refused');
    });

    await expect(readRecordedDatasets(db)).rejects.toThrow(
      'connection refused',
    );
  });
});
