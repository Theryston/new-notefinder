import { describe, expect, it } from 'vitest';

import { profileShareUrl } from './profile-share';

const SITE = new URL('https://notefinder.com.br');

describe('profileShareUrl', () => {
  it('is the canonical locale-prefixed profile URL', () => {
    expect(profileShareUrl(SITE, 'en', 'ada_lovelace')).toBe(
      'https://notefinder.com.br/en/users/ada_lovelace',
    );
  });

  it('keeps the visitor locale in the path', () => {
    expect(profileShareUrl(SITE, 'pt-BR', 'ada_lovelace')).toBe(
      'https://notefinder.com.br/pt-BR/users/ada_lovelace',
    );
  });

  it('ignores any path or query the site URL carries', () => {
    const withPath = new URL('https://notefinder.com.br/some/where?x=1');
    expect(profileShareUrl(withPath, 'en', 'ada')).toBe(
      'https://notefinder.com.br/en/users/ada',
    );
  });
});
