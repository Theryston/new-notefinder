import { describe, expect, it } from 'vitest';

import { localeHeaderName, withLocaleHeader } from './locale-header';

describe('withLocaleHeader', () => {
  it('sets the locale without touching the other headers', () => {
    const source = new Headers({ accept: 'text/html', cookie: 'a=1' });

    const headers = withLocaleHeader(source, 'pt-BR');

    expect(headers.get(localeHeaderName)).toBe('pt-BR');
    expect(headers.get('accept')).toBe('text/html');
    expect(headers.get('cookie')).toBe('a=1');
  });

  it('does not change the source headers it was copied from', () => {
    const source = new Headers({ accept: 'text/html' });

    withLocaleHeader(source, 'en');

    expect(source.get(localeHeaderName)).toBeNull();
  });

  it('replaces a locale a client sent itself', () => {
    const source = new Headers({ [localeHeaderName]: 'pt-BR' });

    const headers = withLocaleHeader(source, 'en');

    expect(headers.get(localeHeaderName)).toBe('en');
  });
});
