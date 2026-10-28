import { afterEach, describe, expect, it, vi } from 'vitest';

const loadGetSiteUrl = async () => {
  vi.resetModules();
  return (await import('./client')).getSiteUrl;
};

describe('getSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the local dev server', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl().href).toBe('http://localhost:3000/');
  });

  it('uses NEXT_PUBLIC_SITE_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://vozzify.com');
    const getSiteUrl = await loadGetSiteUrl();
    expect(getSiteUrl().origin).toBe('https://vozzify.com');
  });

  it('rejects an invalid URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'vozzify.com');
    const getSiteUrl = await loadGetSiteUrl();
    expect(() => getSiteUrl()).toThrowError(/NEXT_PUBLIC_SITE_URL/);
  });
});
