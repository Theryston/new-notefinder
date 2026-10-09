import { parseEnv } from './env.js';

const required = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
};

describe('parseEnv: Track request limits', () => {
  it('leaves the limits unset when the env does not set them', () => {
    const env = parseEnv(required);

    expect(env.PROCESSING_ACTIVE_LIMIT).toBeUndefined();
    expect(env.PROCESSING_NEW_TRACKS_DAILY_LIMIT).toBeUndefined();
    expect(env.PROCESSING_MAX_DURATION_SECONDS).toBeUndefined();
  });

  it('reads the limits as integers from their env strings', () => {
    expect(
      parseEnv({
        ...required,
        PROCESSING_ACTIVE_LIMIT: '3',
        PROCESSING_NEW_TRACKS_DAILY_LIMIT: '20',
        PROCESSING_MAX_DURATION_SECONDS: '900',
      }),
    ).toMatchObject({
      PROCESSING_ACTIVE_LIMIT: 3,
      PROCESSING_NEW_TRACKS_DAILY_LIMIT: 20,
      PROCESSING_MAX_DURATION_SECONDS: 900,
    });
  });

  it('treats a blank limit as unset', () => {
    expect(
      parseEnv({ ...required, PROCESSING_ACTIVE_LIMIT: '' })
        .PROCESSING_ACTIVE_LIMIT,
    ).toBeUndefined();
  });

  it.each([
    ['PROCESSING_ACTIVE_LIMIT', '0'],
    ['PROCESSING_NEW_TRACKS_DAILY_LIMIT', '-1'],
    ['PROCESSING_MAX_DURATION_SECONDS', '12.5'],
  ])('refuses %s=%s at boot', (key, value) => {
    expect(() => parseEnv({ ...required, [key]: value })).toThrow(
      /Invalid environment variables/,
    );
  });
});
