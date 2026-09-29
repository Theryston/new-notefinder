import { parseEnv } from '../../config/env.js';
import { resolveStorageConfig } from './storage-config.js';

const base = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
};
const storage = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'notefinder',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  S3_FORCE_PATH_STYLE: 'true',
  S3_PUBLIC_URL: 'http://localhost:9000/notefinder/',
};

describe('resolveStorageConfig', () => {
  it('maps the S3 settings for a MinIO-like server', () => {
    expect(resolveStorageConfig(parseEnv({ ...base, ...storage }))).toEqual({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'notefinder',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      forcePathStyle: true,
      publicUrl: 'http://localhost:9000/notefinder',
    });
  });

  it('uses the AWS defaults when the endpoint and path style are unset', () => {
    const { S3_ENDPOINT: _, S3_FORCE_PATH_STYLE: __, ...aws } = storage;
    expect(resolveStorageConfig(parseEnv({ ...base, ...aws }))).toMatchObject({
      endpoint: undefined,
      forcePathStyle: false,
    });
  });

  const notConfigured =
    'File storage is not configured: set S3_REGION, S3_BUCKET, ' +
    'S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL';

  it('refuses to boot without any S3 setting', () => {
    expect(() => resolveStorageConfig(parseEnv(base))).toThrowError(
      notConfigured,
    );
  });

  // The env schema rejects a partial config, but this is the last line of
  // defense before an upload fails on a missing value.
  it.each([
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_PUBLIC_URL',
  ] as const)('refuses to boot without %s', (key) => {
    const env = { ...parseEnv({ ...base, ...storage }), [key]: undefined };
    expect(() => resolveStorageConfig(env)).toThrowError(notConfigured);
  });
});
