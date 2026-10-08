import { brightDataProxyOf, createProxiedFetch } from './bright-data-proxy.js';

const proxyEnv = {
  BRIGHT_DATA_PROXY_HOST: 'brd.superproxy.io',
  BRIGHT_DATA_PROXY_PORT: 33335,
  BRIGHT_DATA_PROXY_USERNAME: 'brd-customer-1-zone-yt',
  BRIGHT_DATA_PROXY_PASSWORD: 'secret',
};

describe('brightDataProxyOf', () => {
  it('is undefined when no proxy variable is set', () => {
    expect(
      brightDataProxyOf({
        BRIGHT_DATA_PROXY_HOST: undefined,
        BRIGHT_DATA_PROXY_PORT: undefined,
        BRIGHT_DATA_PROXY_USERNAME: undefined,
        BRIGHT_DATA_PROXY_PASSWORD: undefined,
      }),
    ).toBeUndefined();
  });

  it('is undefined while one of the four is missing', () => {
    expect(
      brightDataProxyOf({
        ...proxyEnv,
        BRIGHT_DATA_PROXY_PASSWORD: undefined,
      }),
    ).toBeUndefined();
  });

  it('builds the proxy address and its basic authentication', () => {
    expect(brightDataProxyOf(proxyEnv)).toEqual({
      uri: 'http://brd.superproxy.io:33335',
      token: `Basic ${Buffer.from('brd-customer-1-zone-yt:secret').toString('base64')}`,
    });
  });
});

describe('createProxiedFetch', () => {
  it('returns a fetch function that routes through the proxy it was given', () => {
    const proxied = createProxiedFetch({
      uri: 'http://brd.superproxy.io:33335',
      token: 'Basic abc',
    });

    expect(typeof proxied).toBe('function');
    expect(proxied).not.toBe(globalThis.fetch);
  });
});
