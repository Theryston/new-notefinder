import type { MusicCatalogError } from '@notefinder/contracts';

const UNAUTHORIZED_ERROR: MusicCatalogError = {
  code: 'UNAUTHORIZED',
  message: 'Missing or invalid API key',
};

/**
 * The raw HTTP answer written to the socket of a handshake that carries no
 * valid API key. The connection never becomes a WebSocket, so the client gets
 * an immediate, unambiguous failure instead of a half-open connection.
 */
export const buildUnauthorizedResponse = (): string => {
  const body = JSON.stringify(UNAUTHORIZED_ERROR);
  return [
    'HTTP/1.1 401 Unauthorized',
    'Content-Type: application/json',
    `Content-Length: ${Buffer.byteLength(body)}`,
    'WWW-Authenticate: Bearer',
    'Connection: close',
    '',
    body,
  ].join('\r\n');
};
