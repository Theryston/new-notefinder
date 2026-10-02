import { assertReplicationToken } from './replication-token.js';

describe('assertReplicationToken', () => {
  it('passes in tiny mode without any token', () => {
    expect(() => assertReplicationToken({ dataset: 'tiny' })).not.toThrow();
  });

  it.each([
    ['the token itself', { token: '40-characters-of-token' }],
    ['the token file', { tokenFile: '/run/secrets/mb-token' }],
  ])('passes in full mode with %s', (_label, token) => {
    expect(() =>
      assertReplicationToken({ dataset: 'full', ...token }),
    ).not.toThrow();
  });

  it('fails in full mode without a token, naming both variables', () => {
    expect(() => assertReplicationToken({ dataset: 'full' })).toThrow(
      /MBSLAVE_MUSICBRAINZ_TOKEN.*MBSLAVE_MUSICBRAINZ_TOKEN_FILE/s,
    );
  });

  it.each([['token'], ['tokenFile'] as const])(
    'treats an empty %s as missing: the compose file defaults both to empty',
    (name) => {
      expect(() =>
        assertReplicationToken({ dataset: 'full', [name]: '' }),
      ).toThrow('MBSLAVE_MUSICBRAINZ_TOKEN');
    },
  );
});
