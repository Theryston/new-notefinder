import { parseEnv } from './env.js';

// The Processing and Bright Data settings, kept apart from env.spec.ts.
const required = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/notefinder',
  REDIS_URL: 'redis://localhost:6379',
};

const brightData = {
  BRIGHT_DATA_PROXY_HOST: 'brd.superproxy.io',
  BRIGHT_DATA_PROXY_PORT: '33335',
  BRIGHT_DATA_PROXY_USERNAME: 'user',
  BRIGHT_DATA_PROXY_PASSWORD: 'secret',
};

describe('parseEnv processing settings', () => {
  it('leaves the maximum duration unset when it is not configured', () => {
    expect(parseEnv(required).PROCESSING_MAX_DURATION_SECONDS).toBeUndefined();
  });

  it('parses the maximum duration in seconds', () => {
    expect(
      parseEnv({ ...required, PROCESSING_MAX_DURATION_SECONDS: '600' })
        .PROCESSING_MAX_DURATION_SECONDS,
    ).toBe(600);
  });

  it('refuses a maximum duration that is not a positive whole number', () => {
    expect(() =>
      parseEnv({ ...required, PROCESSING_MAX_DURATION_SECONDS: '0' }),
    ).toThrow('PROCESSING_MAX_DURATION_SECONDS');
  });

  it('has no Bright Data proxy when none of its variables is set', () => {
    const env = parseEnv(required);

    expect(env.BRIGHT_DATA_PROXY_HOST).toBeUndefined();
    expect(env.BRIGHT_DATA_PROXY_PORT).toBeUndefined();
  });

  it('parses a complete Bright Data proxy', () => {
    expect(parseEnv({ ...required, ...brightData })).toMatchObject({
      BRIGHT_DATA_PROXY_HOST: 'brd.superproxy.io',
      BRIGHT_DATA_PROXY_PORT: 33335,
      BRIGHT_DATA_PROXY_USERNAME: 'user',
      BRIGHT_DATA_PROXY_PASSWORD: 'secret',
    });
  });

  it('requires every Bright Data variable once any of them is set', () => {
    expect(() =>
      parseEnv({ ...required, BRIGHT_DATA_PROXY_HOST: 'brd.superproxy.io' }),
    ).toThrow('Required when any BRIGHT_DATA_PROXY_ variable is set');
  });

  it('counts blank Bright Data variables as unset', () => {
    const blank = Object.fromEntries(
      Object.keys(brightData).map((key) => [key, '']),
    );

    expect(parseEnv({ ...required, ...blank }).BRIGHT_DATA_PROXY_HOST).toBe(
      undefined,
    );
  });
});
