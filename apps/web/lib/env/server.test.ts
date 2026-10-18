import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/** A fresh module per call: `getServerEnv()` memoizes its first result. */
const loadServerEnv = async () => {
  vi.resetModules();
  return (await import('./server')).getServerEnv;
};

describe('SITEMAP_EXTRA_HOSTS', () => {
  beforeEach(() => {
    vi.stubEnv('API_URL', 'http://localhost:3333');
    vi.stubEnv('REVALIDATE_SECRET', 'x'.repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to no extra hosts', async () => {
    const getServerEnv = await loadServerEnv();

    expect(getServerEnv().SITEMAP_EXTRA_HOSTS).toEqual([]);
  });

  it('reads a comma-separated list of hosts, trimmed and lowercased', async () => {
    vi.stubEnv(
      'SITEMAP_EXTRA_HOSTS',
      ' Notefinder.Example , staging.example:8443',
    );
    const getServerEnv = await loadServerEnv();

    expect(getServerEnv().SITEMAP_EXTRA_HOSTS).toEqual([
      'notefinder.example',
      'staging.example:8443',
    ]);
  });

  it('fails at start when an entry is not a bare host', async () => {
    vi.stubEnv('SITEMAP_EXTRA_HOSTS', 'notefinder.example/terms');
    const getServerEnv = await loadServerEnv();

    expect(() => getServerEnv()).toThrow(/SITEMAP_EXTRA_HOSTS/);
  });
});
