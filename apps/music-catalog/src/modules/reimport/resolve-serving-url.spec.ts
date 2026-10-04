import {
  type ReimportPointer,
  resolveServingDatabaseUrl,
} from './resolve-serving-url.js';

const read =
  (states: Record<string, ReimportPointer | Error>) =>
  async (url: string): Promise<ReimportPointer> => {
    const state = states[url];
    if (state instanceof Error) {
      throw state;
    }
    return state;
  };

describe('resolveServingDatabaseUrl', () => {
  it('serves from the configured database without a reimport', async () => {
    await expect(
      resolveServingDatabaseUrl({
        configuredUrl: 'postgres://old/db',
        readReimportState: read({}),
      }),
    ).resolves.toBe('postgres://old/db');
  });

  it.each(['restoring', 'indexing', 'switching'])(
    'serves from the configured database while %s runs',
    async (phase) => {
      await expect(
        resolveServingDatabaseUrl({
          configuredUrl: 'postgres://old/db',
          readReimportState: read({
            'postgres://old/db': { phase, detail: null },
          }),
        }),
      ).resolves.toBe('postgres://old/db');
    },
  );

  it('opens the parallel database after the flip', async () => {
    await expect(
      resolveServingDatabaseUrl({
        configuredUrl: 'postgres://old/db',
        readReimportState: read({
          'postgres://old/db': {
            phase: 'switched',
            detail: 'postgres://new/db',
          },
        }),
      }),
    ).resolves.toBe('postgres://new/db');
  });

  it('ignores a flip without a database to open', async () => {
    await expect(
      resolveServingDatabaseUrl({
        configuredUrl: 'postgres://old/db',
        readReimportState: read({
          'postgres://old/db': { phase: 'switched', detail: null },
        }),
      }),
    ).resolves.toBe('postgres://old/db');
  });

  it('adopts the parallel copy when the retired database is dropped', async () => {
    await expect(
      resolveServingDatabaseUrl({
        configuredUrl: 'postgres://old/db',
        reimportUrl: 'postgres://new/db',
        readReimportState: read({
          'postgres://old/db': new Error('connect ECONNREFUSED'),
          'postgres://new/db': {
            phase: 'switched',
            detail: 'postgres://new/db',
          },
        }),
      }),
    ).resolves.toBe('postgres://new/db');
  });

  it('fails fast when neither copy answers', async () => {
    await expect(
      resolveServingDatabaseUrl({
        configuredUrl: 'postgres://old/db',
        reimportUrl: 'postgres://new/db',
        readReimportState: read({
          'postgres://old/db': new Error('connect ECONNREFUSED'),
          'postgres://new/db': new Error('connect ECONNREFUSED'),
        }),
      }),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('never serves a parallel copy that is not flipped', async () => {
    await expect(
      resolveServingDatabaseUrl({
        configuredUrl: 'postgres://old/db',
        reimportUrl: 'postgres://new/db',
        readReimportState: read({
          'postgres://old/db': new Error('connect ECONNREFUSED'),
          'postgres://new/db': undefined,
        }),
      }),
    ).rejects.toThrow('ECONNREFUSED');
  });
});
