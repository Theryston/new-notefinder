import { parseRestoreEnv } from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5433/db';
const required = {
  DATABASE_URL,
  CATALOG_DATASET: 'tiny',
};

describe('parseRestoreEnv', () => {
  it('defaults to the official MusicBrainz data directory', () => {
    expect(parseRestoreEnv(required)).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL,
      CATALOG_DATASET: 'tiny',
      MUSICBRAINZ_DUMP_BASE_URL:
        'https://data.metabrainz.org/pub/musicbrainz/data',
    });
  });

  it('accepts the full dataset with a custom base URL', () => {
    expect(
      parseRestoreEnv({
        ...required,
        CATALOG_DATASET: 'full',
        MUSICBRAINZ_DUMP_BASE_URL: 'http://fake-mirror:8000/data',
      }),
    ).toMatchObject({
      CATALOG_DATASET: 'full',
      MUSICBRAINZ_DUMP_BASE_URL: 'http://fake-mirror:8000/data',
    });
  });

  it.each([
    ['CATALOG_DATASET', undefined],
    ['CATALOG_DATASET', 'sample'],
  ])(
    'rejects %s=%s: the removed sample dataset fails fast with the valid choices',
    (name, value) => {
      expect(() => parseRestoreEnv({ ...required, [name]: value })).toThrow(
        name,
      );
    },
  );

  it.each([
    ['DATABASE_URL', undefined],
    ['DATABASE_URL', 'not a url'],
    ['MUSICBRAINZ_DUMP_BASE_URL', 'ftp://data.metabrainz.org/pub'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => parseRestoreEnv({ ...required, [name]: value })).toThrow(name);
  });

  it('does not ask for the API keys, which the restore never checks', () => {
    expect(parseRestoreEnv(required)).not.toHaveProperty('API_KEYS');
  });
});
