import { describe, expect, it } from 'vitest';

import type { HomeFeedPage } from './feed-page';
import {
  acceptPublicFeed,
  publicHomeCacheTag,
  publicHomeRequest,
} from './public-feed';

const feed = (audience: string): HomeFeedPage => ({
  audience,
  version: 'a1b2c3d4e5f60718',
  algorithmVersion: 1,
  rows: [],
  nextCursor: null,
});

describe("public home request (the shared cache's API call)", () => {
  it('never forwards the visitor cookies, so the cache holds one answer for everyone', () => {
    expect(publicHomeRequest('en').forwardCookies).toBe(false);
    expect(publicHomeRequest('pt-BR').forwardCookies).toBe(false);
  });

  it('asks for the locale it was given', () => {
    expect(publicHomeRequest('pt-BR').query).toEqual({ locale: 'pt-BR' });
  });
});

describe('publicHomeCacheTag', () => {
  it('scopes the tag to the locale, so one feed never drops the other', () => {
    expect(publicHomeCacheTag('en')).toBe('home:en');
    expect(publicHomeCacheTag('pt-BR')).toBe('home:pt-BR');
    expect(publicHomeCacheTag('en')).not.toBe(publicHomeCacheTag('pt-BR'));
  });
});

describe('acceptPublicFeed', () => {
  it('returns a public feed unchanged', () => {
    const page = feed('public');

    expect(acceptPublicFeed(page)).toBe(page);
  });

  it('refuses a feed of any other audience, so it is never cached', () => {
    expect(() => acceptPublicFeed(feed('personal'))).toThrow(/refusing it/);
  });
});
