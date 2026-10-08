import { parseWorkerEnv } from './env.js';

const worker = {
  DATABASE_URL: 'postgres://user:pass@localhost:5433/db',
  API_KEYS: 'k'.repeat(32),
  CATALOG_DATASET: 'tiny',
  MEILISEARCH_URL: 'http://localhost:7700',
  MEILISEARCH_WRITE_API_KEY: 'write-key',
};

describe('parseWorkerEnv LRCLIB_TINY_SOURCE', () => {
  it('defaults to the offline fake, which the tests rely on', () => {
    expect(parseWorkerEnv(worker).LRCLIB_TINY_SOURCE).toBe('fake');
  });

  it('accepts the real API', () => {
    expect(
      parseWorkerEnv({ ...worker, LRCLIB_TINY_SOURCE: 'api' })
        .LRCLIB_TINY_SOURCE,
    ).toBe('api');
  });

  it('rejects anything else', () => {
    expect(() =>
      parseWorkerEnv({ ...worker, LRCLIB_TINY_SOURCE: 'dump' }),
    ).toThrow('LRCLIB_TINY_SOURCE');
  });
});
