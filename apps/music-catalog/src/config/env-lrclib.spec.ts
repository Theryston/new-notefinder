import { parseWorkerEnv } from './env.js';

const KEY = 'k'.repeat(32);
const worker = {
  DATABASE_URL: 'postgres://user:pass@localhost:5433/db',
  API_KEYS: KEY,
  CATALOG_DATASET: 'tiny',
  MEILISEARCH_URL: 'http://localhost:7700',
  MEILISEARCH_WRITE_API_KEY: 'write-key',
};

describe('parseWorkerEnv LRCLIB settings', () => {
  it('defaults to the public dump locations', () => {
    expect(parseWorkerEnv(worker)).toMatchObject({
      LRCLIB_BASE_URL: 'https://db-dumps.lrclib.net',
      LRCLIB_LISTING_URL:
        'https://lrclib-db-dumps.bu3nnyut4y9jfkdg.workers.dev',
    });
  });

  it('accepts a fake server, the way tests point it', () => {
    expect(
      parseWorkerEnv({
        ...worker,
        LRCLIB_BASE_URL: 'http://127.0.0.1:8080/files',
        LRCLIB_LISTING_URL: 'http://127.0.0.1:8080/listing',
      }),
    ).toMatchObject({
      LRCLIB_BASE_URL: 'http://127.0.0.1:8080/files',
      LRCLIB_LISTING_URL: 'http://127.0.0.1:8080/listing',
    });
  });

  it.each([
    ['LRCLIB_BASE_URL', 'not a url'],
    ['LRCLIB_LISTING_URL', 'ftp://dumps.internal/listing'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => parseWorkerEnv({ ...worker, [name]: value })).toThrow(name);
  });
});
