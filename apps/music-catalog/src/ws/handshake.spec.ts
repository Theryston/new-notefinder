import { musicCatalogErrorSchema } from '@notefinder/contracts';
import { buildUnauthorizedResponse } from './handshake.js';

const parse = (raw: string) => {
  const [head = '', body = ''] = raw.split('\r\n\r\n');
  const [statusLine = '', ...headerLines] = head.split('\r\n');
  const headers = Object.fromEntries(
    headerLines.map((line) => {
      const separator = line.indexOf(':');
      return [
        line.slice(0, separator).toLowerCase(),
        line.slice(separator + 1).trim(),
      ];
    }),
  );
  return { statusLine, headers, body };
};

describe('buildUnauthorizedResponse', () => {
  it('is an HTTP 401 the client can read the reason from', () => {
    const { statusLine, headers, body } = parse(buildUnauthorizedResponse());

    expect(statusLine).toBe('HTTP/1.1 401 Unauthorized');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['www-authenticate']).toBe('Bearer');
    expect(headers.connection).toBe('close');
    expect(musicCatalogErrorSchema.parse(JSON.parse(body))).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid API key',
    });
  });

  it('declares the exact length of its body', () => {
    const { headers, body } = parse(buildUnauthorizedResponse());

    expect(Number(headers['content-length'])).toBe(Buffer.byteLength(body));
  });
});
