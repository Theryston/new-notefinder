import { describe, expect, it } from 'vitest';

import { profileShareUrl } from './profile-share';

const SITE = new URL('https://vozzify.com');

describe('profileShareUrl', () => {
  it('is the canonical locale-prefixed profile URL', () => {
    expect(profileShareUrl(SITE, 'en', 'ada_lovelace')).toBe(
      'https://vozzify.com/en/users/ada_lovelace',
    );
  });

  it('keeps the visitor locale in the path', () => {
    expect(profileShareUrl(SITE, 'pt-BR', 'ada_lovelace')).toBe(
      'https://vozzify.com/pt-BR/users/ada_lovelace',
    );
  });

  it('ignores any path or query the site URL carries', () => {
    const withPath = new URL('https://vozzify.com/some/where?x=1');
    expect(profileShareUrl(withPath, 'en', 'ada')).toBe(
      'https://vozzify.com/en/users/ada',
    );
  });
});
