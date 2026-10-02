import { parseWorkerEnv } from './env.js';

const KEY = 'k'.repeat(32);
const worker = {
  DATABASE_URL: 'postgres://user:pass@localhost:5433/db',
  API_KEYS: KEY,
  CATALOG_DATASET: 'tiny',
  MEILISEARCH_URL: 'http://localhost:7700',
  MEILISEARCH_WRITE_API_KEY: 'write-key',
};

describe('parseWorkerEnv LRCLIB refresh settings', () => {
  it('defaults the API base URL and the refresh intervals', () => {
    expect(parseWorkerEnv(worker)).toMatchObject({
      LRCLIB_API_BASE_URL: 'https://lrclib.net',
      LRCLIB_REFRESH_CHECK_INTERVAL_MS: 3_600_000,
      LRCLIB_REFRESH_MIN_INTERVAL_DAYS: 30,
    });
  });

  it('accepts a fake API server and shorter intervals, the way tests point them', () => {
    expect(
      parseWorkerEnv({
        ...worker,
        LRCLIB_API_BASE_URL: 'http://127.0.0.1:8080',
        LRCLIB_REFRESH_CHECK_INTERVAL_MS: '1000',
        LRCLIB_REFRESH_MIN_INTERVAL_DAYS: '1',
      }),
    ).toMatchObject({
      LRCLIB_API_BASE_URL: 'http://127.0.0.1:8080',
      LRCLIB_REFRESH_CHECK_INTERVAL_MS: 1000,
      LRCLIB_REFRESH_MIN_INTERVAL_DAYS: 1,
    });
  });

  it.each([
    ['LRCLIB_API_BASE_URL', 'not a url'],
    ['LRCLIB_API_BASE_URL', 'ftp://lyrics.internal/api'],
    ['LRCLIB_REFRESH_CHECK_INTERVAL_MS', '0'],
    ['LRCLIB_REFRESH_CHECK_INTERVAL_MS', 'soon'],
    ['LRCLIB_REFRESH_MIN_INTERVAL_DAYS', '0'],
    ['LRCLIB_REFRESH_MIN_INTERVAL_DAYS', 'often'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => parseWorkerEnv({ ...worker, [name]: value })).toThrow(name);
  });
});
