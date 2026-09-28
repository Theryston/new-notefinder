import { describe, expect, it } from 'vitest';

import {
  absoluteAppUrl,
  authHref,
  DEFAULT_REDIRECT,
  hrefToPath,
  redirectToFromSearch,
  safeRedirectPath,
} from './redirect-to';

describe('safeRedirectPath', () => {
  it.each([
    ['/me/edit', '/me/edit'],
    ['/tracks/abc?x=1#top', '/tracks/abc?x=1#top'],
    ['/pt-BR/tracks/abc', '/tracks/abc'],
    ['/en', '/'],
    ['/english/page', '/english/page'],
  ])('keeps the same-origin path %j as %j', (value, expected) => {
    expect(safeRedirectPath(value)).toBe(expected);
  });

  it.each([
    [undefined],
    [null],
    [''],
    ['me/edit'],
    ['//evil.com/path'],
    ['/\\evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
  ])('falls back to / for %j', (value) => {
    expect(safeRedirectPath(value)).toBe(DEFAULT_REDIRECT);
  });
});

describe('redirectToFromSearch', () => {
  it('reads and sanitizes the param', () => {
    expect(redirectToFromSearch('?redirectTo=%2Fme%2Fedit&x=1')).toBe(
      '/me/edit',
    );
    expect(redirectToFromSearch('?redirectTo=https://evil.com')).toBe('/');
    expect(redirectToFromSearch('')).toBe('/');
  });
});

describe('authHref', () => {
  it('leaves out the default redirect', () => {
    expect(authHref('/sign-in', '/')).toEqual({
      pathname: '/sign-in',
      query: {},
    });
  });

  it('carries a custom redirect and extra params', () => {
    expect(
      authHref('/verify-email', '/me/edit', { email: 'ada@example.com' }),
    ).toEqual({
      pathname: '/verify-email',
      query: { email: 'ada@example.com', redirectTo: '/me/edit' },
    });
  });
});

describe('hrefToPath', () => {
  it('encodes the query', () => {
    expect(hrefToPath(authHref('/setup-username', '/tracks/a?b=1'))).toBe(
      '/setup-username?redirectTo=%2Ftracks%2Fa%3Fb%3D1',
    );
  });

  it('has no "?" without a query', () => {
    expect(hrefToPath(authHref('/sign-up', '/'))).toBe('/sign-up');
  });
});

describe('absoluteAppUrl', () => {
  it('prefixes the locale', () => {
    expect(absoluteAppUrl('https://x.com', 'pt-BR', '/me/edit')).toBe(
      'https://x.com/pt-BR/me/edit',
    );
  });

  it('points the default redirect at the locale home', () => {
    expect(absoluteAppUrl('https://x.com', 'en', '/')).toBe('https://x.com/en');
  });
});
