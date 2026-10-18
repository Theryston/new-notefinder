import { beforeEach, describe, expect, it, vi } from 'vitest';

// Both env readers are replaced: the values differ from the defaults
// (localhost:3000, no extra hosts), so a test passes only when the module
// really reads its configuration.
const config = vi.hoisted(() => ({
  site: new URL('https://notefinder.com.br/'),
  extraHosts: [] as string[],
}));

vi.mock('@/lib/env/client', () => ({
  getSiteUrl: () => config.site,
}));

vi.mock('@/lib/env/server', () => ({
  getServerEnv: () => ({ SITEMAP_EXTRA_HOSTS: config.extraHosts }),
}));

const { requestSiteOrigin } = await import('./request-origin');

const request = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

describe('requestSiteOrigin', () => {
  beforeEach(() => {
    config.site = new URL('https://notefinder.com.br/');
    config.extraHosts = [];
  });

  it('answers for the site host, forwarded by the CDN', () => {
    expect(
      requestSiteOrigin(
        request('http://internal:3000/sitemap.xml', {
          'x-forwarded-host': 'notefinder.com.br',
        }),
      ),
    ).toBe('https://notefinder.com.br');
  });

  it('takes the protocol from the site URL, not from the internal request', () => {
    expect(
      requestSiteOrigin(
        request('http://internal/robots.txt', {
          'x-forwarded-host': 'notefinder.com.br',
          'x-forwarded-proto': 'http',
        }),
      ),
    ).toBe('https://notefinder.com.br');
  });

  it('honors an extra domain from the allowlist, with its port', () => {
    config.site = new URL('http://localhost:3000');
    config.extraHosts = ['staging.example:8443'];

    expect(
      requestSiteOrigin(
        request('http://internal/sitemap.xml', {
          'x-forwarded-host': 'staging.example:8443, proxy.internal',
        }),
      ),
    ).toBe('http://staging.example:8443');
  });

  it('matches the host regardless of case', () => {
    config.extraHosts = ['staging.example'];

    expect(
      requestSiteOrigin(
        request('http://internal/sitemap.xml', {
          'x-forwarded-host': 'STAGING.example',
        }),
      ),
    ).toBe('https://staging.example');
  });

  it('falls back to the site origin for a well-formed host that is not allowed', () => {
    config.extraHosts = ['staging.example'];

    expect(
      requestSiteOrigin(
        request('http://internal/sitemap.xml', {
          'x-forwarded-host': 'unknown.example',
        }),
      ),
    ).toBe('https://notefinder.com.br');
  });

  it('uses the Host header when nothing is forwarded, if it is allowed', () => {
    config.site = new URL('http://localhost:3000');

    expect(
      requestSiteOrigin(
        request('http://localhost:3000/robots.txt', { host: 'localhost:3000' }),
      ),
    ).toBe('http://localhost:3000');
  });

  it('refuses a host that carries a path, a query, a fragment or credentials', () => {
    for (const host of [
      'notefinder.com.br/path',
      'notefinder.com.br?x=1',
      'notefinder.com.br#x',
      'a.example#x',
      'user@notefinder.com.br',
    ]) {
      expect(
        requestSiteOrigin(
          request('https://notefinder.com.br/sitemap.xml', {
            'x-forwarded-host': host,
          }),
        ),
      ).toBe('https://notefinder.com.br');
    }
  });

  it('answers with the site origin when the request carries no host', () => {
    config.site = new URL('https://notefinder.com.br/');

    expect(requestSiteOrigin(new Request('http://internal/sitemap.xml'))).toBe(
      'https://notefinder.com.br',
    );
  });
});
