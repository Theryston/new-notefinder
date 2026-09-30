import { musicCatalogErrorSchema } from '@notefinder/contracts';
import {
  API_KEY,
  ROTATED_API_KEY,
  useTestServer,
} from './utils/create-test-server.js';
import { openClient } from './utils/ws-client.js';

describe('WebSocket handshake (e2e)', () => {
  const server = useTestServer();

  it.each([
    ['the first configured key', API_KEY],
    ['the second configured key, so keys can be rotated', ROTATED_API_KEY],
  ])('opens the connection with %s', async (_label, key) => {
    const handshake = await openClient(server().url, { key });

    expect(handshake.opened).toBe(true);
    if (handshake.opened) {
      await handshake.client.close();
    }
  });

  it.each([
    ['no Authorization header', {}],
    ['a wrong key', { key: 'x'.repeat(40) }],
    [
      'a key that only shares a prefix with a valid one',
      { key: API_KEY.slice(0, 20) },
    ],
    ['the key without the Bearer scheme', { authorization: API_KEY }],
    ['another scheme', { authorization: `Basic ${API_KEY}` }],
    ['an empty Bearer token', { authorization: 'Bearer ' }],
  ])('refuses the handshake with HTTP 401 for %s', async (_label, options) => {
    const handshake = await openClient(server().url, options);

    expect(handshake).toMatchObject({ opened: false, status: 401 });
  });

  it('explains the refusal with the UNAUTHORIZED error, as JSON', async () => {
    const handshake = await openClient(server().url, { key: 'wrong' });

    if (handshake.opened) {
      throw new Error('The handshake should have been refused');
    }
    expect(handshake.headers['content-type']).toBe('application/json');
    expect(handshake.headers['www-authenticate']).toBe('Bearer');
    expect(musicCatalogErrorSchema.parse(JSON.parse(handshake.body))).toEqual({
      code: 'UNAUTHORIZED',
      message: expect.any(String),
    });
  });

  it('answers a plain HTTP request that is not a WebSocket upgrade', async () => {
    const response = await fetch(server().url.replace('ws:', 'http:'), {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.status).toBe(426);
  });
});
