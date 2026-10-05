import { parseWorkerEnv } from './env.js';

const KEY = 'k'.repeat(32);
const worker = {
  DATABASE_URL: 'postgres://user:pass@localhost:5433/db',
  API_KEYS: KEY,
  CATALOG_DATASET: 'tiny',
  MEILISEARCH_URL: 'http://localhost:7700',
  MEILISEARCH_WRITE_API_KEY: 'write-key',
};

describe('parseWorkerEnv heartbeat file', () => {
  it('writes no heartbeat file unless told where', () => {
    expect(parseWorkerEnv(worker).WORKER_HEARTBEAT_FILE).toBeUndefined();
  });

  it('keeps the path the deployment points the health check at', () => {
    expect(
      parseWorkerEnv({ ...worker, WORKER_HEARTBEAT_FILE: '/tmp/heartbeat' })
        .WORKER_HEARTBEAT_FILE,
    ).toBe('/tmp/heartbeat');
  });

  it('rejects an empty path instead of silently writing nothing', () => {
    expect(() =>
      parseWorkerEnv({ ...worker, WORKER_HEARTBEAT_FILE: '' }),
    ).toThrow('WORKER_HEARTBEAT_FILE');
  });
});
