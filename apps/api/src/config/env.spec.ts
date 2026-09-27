import { parseEnv } from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
const REDIS_URL = 'redis://localhost:6379';
const required = { DATABASE_URL, REDIS_URL };
const SECRET = 'x'.repeat(32);

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3333,
      WEB_ORIGINS: ['http://localhost:3000'],
      SWAGGER_ENABLED: true,
      DATABASE_URL,
      REDIS_URL,
      TRUST_PROXY: 'loopback, linklocal, uniquelocal',
      RATE_LIMIT_TTL_SECONDS: 60,
      RATE_LIMIT_MAX: 120,
      WEB_URL: 'http://localhost:3000',
      REVALIDATE_SECRET: undefined,
    });
  });

  it('parses a production config', () => {
    expect(
      parseEnv({
        DATABASE_URL,
        NODE_ENV: 'production',
        PORT: '8080',
        WEB_ORIGINS: 'https://notefinder.com.br, https://www.notefinder.com.br',
        REDIS_URL: 'rediss://user:pass@redis.internal:6380/1',
        TRUST_PROXY: '2',
        RATE_LIMIT_TTL_SECONDS: '30',
        RATE_LIMIT_MAX: '60',
        WEB_URL: 'https://notefinder.com.br/',
        REVALIDATE_SECRET: SECRET,
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      WEB_ORIGINS: [
        'https://notefinder.com.br',
        'https://www.notefinder.com.br',
      ],
      SWAGGER_ENABLED: false,
      DATABASE_URL,
      REDIS_URL: 'rediss://user:pass@redis.internal:6380/1',
      TRUST_PROXY: 2,
      RATE_LIMIT_TTL_SECONDS: 30,
      RATE_LIMIT_MAX: 60,
      WEB_URL: 'https://notefinder.com.br',
      REVALIDATE_SECRET: SECRET,
    });
  });

  it('lets SWAGGER_ENABLED override the production default', () => {
    expect(
      parseEnv({
        ...required,
        NODE_ENV: 'production',
        SWAGGER_ENABLED: 'true',
        REVALIDATE_SECRET: SECRET,
      }).SWAGGER_ENABLED,
    ).toBe(true);
    expect(
      parseEnv({ ...required, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', 1],
    ['10.0.0.0/8, 172.16.0.0/12', '10.0.0.0/8, 172.16.0.0/12'],
  ])('parses TRUST_PROXY=%s', (value, expected) => {
    expect(parseEnv({ ...required, TRUST_PROXY: value }).TRUST_PROXY).toBe(
      expected,
    );
  });

  it('requires a Postgres DATABASE_URL', () => {
    expect(() => parseEnv({ REDIS_URL })).toThrowError(/DATABASE_URL/);
    expect(() =>
      parseEnv({ REDIS_URL, DATABASE_URL: 'mysql://localhost:3306/db' }),
    ).toThrowError(/DATABASE_URL/);
    expect(
      parseEnv({ REDIS_URL, DATABASE_URL: 'postgresql://localhost/db' })
        .DATABASE_URL,
    ).toBe('postgresql://localhost/db');
  });

  it('requires a Redis URL', () => {
    expect(() => parseEnv({ DATABASE_URL })).toThrowError(/REDIS_URL/);
    expect(() =>
      parseEnv({ DATABASE_URL, REDIS_URL: 'http://localhost' }),
    ).toThrowError(/REDIS_URL/);
  });

  it('requires REVALIDATE_SECRET only in production', () => {
    expect(() =>
      parseEnv({ ...required, NODE_ENV: 'production' }),
    ).toThrowError(/REVALIDATE_SECRET/);
    expect(
      parseEnv({ ...required, REVALIDATE_SECRET: '' }).REVALIDATE_SECRET,
    ).toBe(undefined);
    expect(() =>
      parseEnv({ ...required, REVALIDATE_SECRET: 'too-short' }),
    ).toThrowError(/REVALIDATE_SECRET/);
  });

  it('fails fast with a readable message', () => {
    expect(() =>
      parseEnv({ ...required, PORT: 'abc', WEB_ORIGINS: 'not-a-url' }),
    ).toThrowError(
      /Invalid environment variables:[\s\S]*PORT[\s\S]*WEB_ORIGINS/,
    );
  });
});
