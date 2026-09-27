import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3333,
      WEB_ORIGINS: ['http://localhost:3000'],
      SWAGGER_ENABLED: true,
    });
  });

  it('parses a production config', () => {
    expect(
      parseEnv({
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
    });
  });

  it('lets SWAGGER_ENABLED override the production default', () => {
    expect(
      parseEnv({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })
        .SWAGGER_ENABLED,
    ).toBe(true);
    expect(parseEnv({ SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
  });

  it('fails fast with a readable message', () => {
    expect(() =>
      parseEnv({ PORT: 'abc', WEB_ORIGINS: 'not-a-url' }),
    ).toThrowError(
      /Invalid environment variables:[\s\S]*PORT[\s\S]*WEB_ORIGINS/,
    );
  });
});
