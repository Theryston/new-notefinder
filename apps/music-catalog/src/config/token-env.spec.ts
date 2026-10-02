import {
  mbslaveSpawnEnv,
  parseRestoreEnv,
  withoutBlankTokenVars,
} from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5433/db';
const required = {
  DATABASE_URL,
  CATALOG_DATASET: 'tiny',
};

describe('withoutBlankTokenVars', () => {
  it('leaves a source without token variables alone', () => {
    expect(withoutBlankTokenVars(required)).toEqual(required);
  });

  it('keeps non-empty token values', () => {
    const source = {
      ...required,
      MBSLAVE_MUSICBRAINZ_TOKEN: 'token',
      MBSLAVE_MUSICBRAINZ_TOKEN_FILE: '/run/secrets/mb-token',
    };

    expect(withoutBlankTokenVars(source)).toEqual(source);
  });

  it.each([['MBSLAVE_MUSICBRAINZ_TOKEN'], ['MBSLAVE_MUSICBRAINZ_TOKEN_FILE']])(
    'drops a blank %s the compose file defaults',
    (name) => {
      const cleaned = withoutBlankTokenVars({ ...required, [name]: ' ' });

      expect(cleaned).toEqual(required);
      expect(cleaned).not.toHaveProperty(name);
    },
  );
});

describe('mbslaveSpawnEnv', () => {
  it('drops blank token variables, so mbslave never opens an empty path', () => {
    vi.stubEnv('MBSLAVE_MUSICBRAINZ_TOKEN', '');
    vi.stubEnv('MBSLAVE_MUSICBRAINZ_TOKEN_FILE', ' ');
    try {
      const env = mbslaveSpawnEnv();

      expect(env).not.toHaveProperty('MBSLAVE_MUSICBRAINZ_TOKEN');
      expect(env).not.toHaveProperty('MBSLAVE_MUSICBRAINZ_TOKEN_FILE');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('keeps the rest of the environment for the binary', () => {
    vi.stubEnv('MBSALVE_SPAWN_ENV_PROBE', 'probe-value');
    try {
      expect(mbslaveSpawnEnv()).toMatchObject({
        MBSALVE_SPAWN_ENV_PROBE: 'probe-value',
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('parseRestoreEnv with the token variables', () => {
  it('accepts a token in full mode', () => {
    expect(
      parseRestoreEnv({
        ...required,
        CATALOG_DATASET: 'full',
        MBSLAVE_MUSICBRAINZ_TOKEN: 'token',
      }),
    ).toMatchObject({
      CATALOG_DATASET: 'full',
      MBSLAVE_MUSICBRAINZ_TOKEN: 'token',
    });
  });

  it('still parses without a token: the replication service requires it, not the restore', () => {
    expect(parseRestoreEnv(required)).not.toHaveProperty(
      'MBSLAVE_MUSICBRAINZ_TOKEN',
    );
  });
});
