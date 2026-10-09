import { parseEnv } from './env.js';

// The audio download settings, kept apart from env.spec.ts.
const required = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/notefinder',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseEnv download settings', () => {
  it('leaves the RapidAPI key and the ffmpeg path unset when they are not configured', () => {
    const env = parseEnv(required);

    expect(env.RAPIDAPI_API_KEY).toBeUndefined();
    expect(env.FFMPEG_PATH).toBeUndefined();
  });

  it('parses the RapidAPI key and the ffmpeg path', () => {
    expect(
      parseEnv({
        ...required,
        RAPIDAPI_API_KEY: 'rapid-key',
        FFMPEG_PATH: '/opt/ffmpeg/bin/ffmpeg',
      }),
    ).toMatchObject({
      RAPIDAPI_API_KEY: 'rapid-key',
      FFMPEG_PATH: '/opt/ffmpeg/bin/ffmpeg',
    });
  });

  it('counts blank values as unset', () => {
    const env = parseEnv({
      ...required,
      RAPIDAPI_API_KEY: '',
      FFMPEG_PATH: '',
    });

    expect(env.RAPIDAPI_API_KEY).toBeUndefined();
    expect(env.FFMPEG_PATH).toBeUndefined();
  });
});
