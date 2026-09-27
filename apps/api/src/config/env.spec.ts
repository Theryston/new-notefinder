import { parseEnv } from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
const required = { DATABASE_URL };

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3333,
      WEB_ORIGINS: ['http://localhost:3000'],
      SWAGGER_ENABLED: true,
      DATABASE_URL,
    });
  });

  it('parses a production config', () => {
    expect(
      parseEnv({
        ...required,
        NODE_ENV: 'production',
        PORT: '8080',
        WEB_ORIGINS: 'https://notefinder.com.br, https://www.notefinder.com.br',
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
    });
  });

  it('lets SWAGGER_ENABLED override the production default', () => {
    expect(
      parseEnv({ ...required, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })
        .SWAGGER_ENABLED,
    ).toBe(true);
    expect(
      parseEnv({ ...required, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('fails fast with a readable message', () => {
    expect(() =>
      parseEnv({ ...required, PORT: 'abc', WEB_ORIGINS: 'not-a-url' }),
    ).toThrowError(
      /Invalid environment variables:[\s\S]*PORT[\s\S]*WEB_ORIGINS/,
    );
  });

  it('requires a Postgres DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrowError(/DATABASE_URL/);
    expect(() =>
      parseEnv({ DATABASE_URL: 'mysql://localhost:3306/db' }),
    ).toThrowError(/DATABASE_URL/);
    expect(
      parseEnv({ DATABASE_URL: 'postgresql://localhost/db' }).DATABASE_URL,
    ).toBe('postgresql://localhost/db');
  });
});
