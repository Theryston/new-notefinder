import { parseEnv } from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5433/db';
const KEY_A = 'a'.repeat(32);
const KEY_B = 'b'.repeat(40);
const required = {
  DATABASE_URL,
  API_KEYS: KEY_A,
  CATALOG_DATASET: 'tiny',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3334,
      DATABASE_URL,
      API_KEYS: [KEY_A],
      CATALOG_DATASET: 'tiny',
      HEARTBEAT_INTERVAL_MS: 30_000,
      REQUEST_TIMEOUT_MS: 10_000,
    });
  });

  it('parses a full production config', () => {
    expect(
      parseEnv({
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL: 'postgresql://user:pass@db.internal:5432/catalog',
        API_KEYS: KEY_A,
        CATALOG_DATASET: 'full',
        HEARTBEAT_INTERVAL_MS: '15000',
        REQUEST_TIMEOUT_MS: '5000',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      DATABASE_URL: 'postgresql://user:pass@db.internal:5432/catalog',
      API_KEYS: [KEY_A],
      CATALOG_DATASET: 'full',
      HEARTBEAT_INTERVAL_MS: 15_000,
      REQUEST_TIMEOUT_MS: 5000,
    });
  });

  it.each(['development', 'test', 'production'])(
    'accepts NODE_ENV=%s',
    (nodeEnv) => {
      expect(parseEnv({ ...required, NODE_ENV: nodeEnv }).NODE_ENV).toBe(
        nodeEnv,
      );
    },
  );

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ ...required, NODE_ENV: 'staging' })).toThrow(
      'NODE_ENV',
    );
  });

  it('accepts port 0 so tests can pick a free port', () => {
    expect(parseEnv({ ...required, PORT: '0' }).PORT).toBe(0);
  });

  it('splits API_KEYS on commas, trimming and skipping blanks', () => {
    expect(
      parseEnv({ ...required, API_KEYS: ` ${KEY_A} , ,${KEY_B},` }).API_KEYS,
    ).toEqual([KEY_A, KEY_B]);
  });

  it.each([
    ['is missing', undefined],
    ['is empty', ''],
    ['only has blanks', ' , '],
    ['has a key shorter than 32 characters', `${KEY_A},short`],
  ])('rejects API_KEYS that %s', (_label, value) => {
    expect(() => parseEnv({ ...required, API_KEYS: value })).toThrow(
      /API_KEYS/,
    );
  });

  it.each([
    ['is missing', undefined],
    ['is not a postgres URL', 'http://localhost:5433/db'],
    ['is not a URL', 'not a url'],
    ['has a scheme that only ends like postgres', 'mypostgres://u:p@h:5433/db'],
    [
      'has a scheme that only starts like postgres',
      'postgresx://u:p@h:5433/db',
    ],
  ])('rejects a DATABASE_URL that %s', (_label, value) => {
    expect(() => parseEnv({ ...required, DATABASE_URL: value })).toThrow(
      /DATABASE_URL/,
    );
  });

  it.each([
    ['is missing', undefined],
    ['is not full or tiny', 'huge'],
    ['is the removed sample dataset', 'sample'],
  ])('rejects a CATALOG_DATASET that %s', (_label, value) => {
    expect(() => parseEnv({ ...required, CATALOG_DATASET: value })).toThrow(
      /CATALOG_DATASET/,
    );
  });

  it.each([
    ['PORT', '65536'],
    ['PORT', '-1'],
    ['HEARTBEAT_INTERVAL_MS', '0'],
    ['REQUEST_TIMEOUT_MS', '0'],
    ['REQUEST_TIMEOUT_MS', 'soon'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => parseEnv({ ...required, [name]: value })).toThrow(name);
  });

  it('lists every problem in one error, so a bad config is fixed at once', () => {
    expect(() => parseEnv({})).toThrow(
      /Invalid environment variables[\s\S]*DATABASE_URL[\s\S]*API_KEYS[\s\S]*CATALOG_DATASET/,
    );
  });
});
