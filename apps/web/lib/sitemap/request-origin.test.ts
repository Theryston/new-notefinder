import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestSiteOrigin } from './request-origin';

const request = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

describe('requestSiteOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the forwarded host and protocol the CDN sends', () => {
    expect(
      requestSiteOrigin(
        request('http://internal:3000/sitemap.xml', {
          'x-forwarded-host': 'notefinder.com.br',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toBe('https://notefinder.com.br');
  });

  it('keeps a port and takes the first value of a forwarded list', () => {
    expect(
      requestSiteOrigin(
        request('http://internal/sitemap.xml', {
          'x-forwarded-host': 'staging.example:8443, proxy.internal',
          'x-forwarded-proto': 'https, http',
        }),
      ),
    ).toBe('https://staging.example:8443');
  });

  it('falls back to the Host header when nothing is forwarded', () => {
    expect(
      requestSiteOrigin(
        request('http://localhost:3000/robots.txt', { host: 'localhost:3000' }),
      ),
    ).toBe('http://localhost:3000');
  });

  it('takes the protocol from the request URL when none is forwarded', () => {
    expect(
      requestSiteOrigin(
        request('https://notefinder.com.br/robots.txt', {
          host: 'notefinder.com.br',
        }),
      ),
    ).toBe('https://notefinder.com.br');
  });

  it('refuses a host that carries a path, credentials or a query', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://notefinder.com.br');
    for (const host of [
      'evil.example/path',
      'user@evil.example',
      'a.example?x=1',
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

  it('falls back to the public site URL when the host is unusable', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://notefinder.com.br/');
    expect(
      requestSiteOrigin(
        request('https://internal/sitemap.xml', {
          'x-forwarded-host': 'bad host',
        }),
      ),
    ).toBe('https://notefinder.com.br');
  });

  it('uses the public site URL env when the request carries no host', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://notefinder.com.br');
    expect(requestSiteOrigin(new Request('https://internal/sitemap.xml'))).toBe(
      'https://notefinder.com.br',
    );
  });
});
