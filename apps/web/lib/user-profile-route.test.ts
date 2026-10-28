import { describe, expect, it, vi } from 'vitest';

import {
  fetchUserProfileVerdict,
  needsLowercaseRedirect,
  parseUserProfileRoute,
  userProfileRedirectUrl,
} from './user-profile-route';

describe('parseUserProfileRoute', () => {
  it('reads the locale and the decoded username of a profile path', () => {
    expect(parseUserProfileRoute('/pt-BR/users/ada%20l')).toEqual({
      locale: 'pt-BR',
      username: 'ada l',
    });
    expect(parseUserProfileRoute('/en/users/grace/')).toEqual({
      locale: 'en',
      username: 'grace',
    });
  });

  it('ignores other paths, unknown locales and malformed encoding', () => {
    expect(parseUserProfileRoute('/en/artists/clx1')).toBeUndefined();
    expect(parseUserProfileRoute('/fr/users/grace')).toBeUndefined();
    expect(parseUserProfileRoute('/en/users/grace/extra')).toBeUndefined();
    expect(parseUserProfileRoute('/en/users/%E0%A4%A')).toBeUndefined();
  });
});

describe('needsLowercaseRedirect', () => {
  it('flags any username with an uppercase letter', () => {
    expect(needsLowercaseRedirect('Theryston')).toBe(true);
    expect(needsLowercaseRedirect('theryston')).toBe(false);
  });
});

describe('userProfileRedirectUrl', () => {
  it('lowercases the username and keeps the query', () => {
    const url = userProfileRedirectUrl(
      'https://vozzify.test/en/users/Ada_Lovelace?x=1&time=30',
      'Ada_Lovelace',
    );

    expect(url.pathname).toBe('/en/users/ada_lovelace');
    expect(url.search).toBe('?x=1&time=30');
  });
});

describe('fetchUserProfileVerdict', () => {
  it('asks the API for the username and answers a 404 as missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 404,
      json: () =>
        Promise.resolve({ statusCode: 404, code: 'NOT_FOUND', message: 'x' }),
    });

    const verdict = await fetchUserProfileVerdict(
      'https://api.test/',
      'nobody',
      fetchFn,
    );

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.test/v1/users/nobody',
      expect.any(Object),
    );
    expect(verdict).toEqual({ kind: 'missing' });
  });

  it('lets an existing Profile through', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({}),
    });

    expect(
      await fetchUserProfileVerdict('https://api.test', 'grace', fetchFn),
    ).toEqual({ kind: 'pass' });
  });
});
